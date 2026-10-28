import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeletionService } from './deletion.mjs';
import { memoryAdmin } from './test-admin.mjs';

function fixture() {
  let time = 1_000_000;
  let failMedia = false;
  const removedPrefixes = [];
  const admin = memoryAdmin({
    'users/owner': { uid: 'owner' }, 'barbers/owner': { ownerUid: 'owner' },
    'users/peer': { uid: 'peer', referredBy: 'owner' },
    'bookings/appointment': { customerUid: 'owner', barberId: 'peer' },
    'messages/appointment/msgs/message1': { fromUid: 'peer' },
    'posts/own-post': { ownerUid: 'owner' }, 'posts/own-post/comments/comment1': { fromUid: 'peer' },
    'posts/peer-post': { ownerUid: 'peer' }, 'devices/owner/tokens/phone': { token: 'fixture-token' },
    'notifications/to-owner': { toUid: 'owner', fromUid: 'peer' },
  });
  const media = { removePrefixBatch: async (bucket, prefix) => {
    if (failMedia) throw new Error('temporary backend failure');
    removedPrefixes.push({ bucket, prefix }); return 0;
  } };
  const create = () => createDeletionService({ admin, media, now: () => time });
  return { admin, removedPrefixes, create, time: () => time, advance: ms => { time += ms; }, fail: value => { failMedia = value; }, user: () => ({ uid: 'owner', claims: { auth_time: time / 1000 } }) };
}

test('deletion requires a recent sign-in and an explicit scoped confirmation', async () => {
  const f = fixture(); const deletion = f.create();
  await assert.rejects(deletion.prepare({ uid: 'owner', claims: { auth_time: 1 } }), { code: 'failed-precondition' });
  const job = await deletion.prepare(f.user());
  assert.equal((await f.admin.get('users/owner')).data.uid, 'owner');
  assert.equal(f.admin.deletedUsers.size, 0);
  await assert.rejects(deletion.confirm(job.jobId, 'x'.repeat(72)), { code: 'permission-denied' });
  assert.equal(await f.admin.get('accountDeletionLocks/owner'), null);
  await deletion.confirm(job.jobId, job.jobToken);
  assert.equal((await f.admin.get('accountDeletionLocks/owner')).data.jobId, job.jobId);
});

test('a confirmed deletion removes Auth, nested records and both media stores without deleting another profile', async () => {
  const f = fixture(); const deletion = f.create();
  const job = await deletion.prepare(f.user()); await deletion.confirm(job.jobId, job.jobToken);
  for (let attempt = 0; attempt < 12 && (await deletion.status(job.jobId, job.jobToken)).status !== 'deleted'; attempt++) await deletion.process(job.jobId);
  assert.equal((await deletion.status(job.jobId, job.jobToken)).status, 'deleted');
  for (const path of ['users/owner', 'barbers/owner', 'bookings/appointment', 'messages/appointment/msgs/message1', 'posts/own-post', 'posts/own-post/comments/comment1', 'devices/owner/tokens/phone', 'notifications/to-owner']) assert.equal(await f.admin.get(path), null, path);
  assert.equal((await f.admin.get('users/peer')).data.uid, 'peer');
  assert.equal((await f.admin.get('users/peer')).data.referredBy, undefined);
  assert.ok(await f.admin.get('posts/peer-post'));
  assert.deepEqual([...f.admin.deletedUsers], ['owner']);
  assert.ok(f.removedPrefixes.some(item => item.bucket === 'halaqi-chat' && item.prefix === 'chats/appointment'));
  const completed = await f.admin.get(`accountDeletionJobs/${job.jobId}`);
  assert.equal(completed.data.uid, undefined);
  assert.equal((await f.admin.get('accountDeletionLocks/owner')).data.state, 'completed');
  assert.deepEqual((await f.admin.get('accountDeletionBookingLocks/appointment')).data, { blocked: true });
  assert.deepEqual((await f.admin.get('accountDeletionPostLocks/own-post')).data, { blocked: true });
  f.advance(2 * 3600_000 + 1); await deletion.runPending();
  assert.equal(await f.admin.get('accountDeletionLocks/owner'), null);
  assert.deepEqual((await f.admin.get('accountDeletionBookingLocks/appointment')).data, { blocked: true });
});

test('temporary storage failures preserve a durable retry job that resumes after app/service restart', async () => {
  const f = fixture(); const first = f.create(); const job = await first.prepare(f.user());
  await first.confirm(job.jobId, job.jobToken); f.fail(true); await first.process(job.jobId);
  assert.equal((await f.admin.get(`accountDeletionJobs/${job.jobId}`)).data.state, 'retry');
  assert.equal(f.admin.deletedUsers.size, 0);
  assert.ok(await f.admin.get('accountDeletionLocks/owner'));
  f.fail(false); f.advance(120_000); const restarted = f.create();
  for (let attempt = 0; attempt < 12 && (await restarted.status(job.jobId, job.jobToken)).status !== 'deleted'; attempt++) await restarted.process(job.jobId);
  assert.equal((await restarted.status(job.jobId, job.jobToken)).status, 'deleted');
});

test('an expired unconfirmed request never deletes or disables the account', async () => {
  const f = fixture(); const deletion = f.create(); const job = await deletion.prepare(f.user());
  f.advance(16 * 60_000);
  await assert.rejects(deletion.confirm(job.jobId, job.jobToken), { code: 'failed-precondition' });
  await deletion.runPending();
  assert.equal(await f.admin.get(`accountDeletionJobs/${job.jobId}`), null);
  assert.ok(await f.admin.get('users/owner'));
  assert.equal(f.admin.users.size, 0);
});

test('deletion waits for a peer upload beyond the first hundred operation records', async () => {
  const f = fixture(); const deletion = f.create();
  for (let index = 0; index < 125; index++) await f.admin.set(`mediaUploadOperations/a-${String(index).padStart(3, '0')}`, {
    uid: 'unrelated', relatedUids: ['unrelated'], expiresAt: f.time() + 180_000,
  });
  await f.admin.set('mediaUploadOperations/z-peer-upload', { uid: 'peer', relatedUids: ['peer', 'owner'], expiresAt: f.time() + 180_000 });
  const job = await deletion.prepare(f.user()); await deletion.confirm(job.jobId, job.jobToken);
  await deletion.process(job.jobId);
  assert.equal((await f.admin.get(`accountDeletionJobs/${job.jobId}`)).data.stage, 'wait-uploads');
  assert.equal(f.admin.deletedUsers.size, 0);
  assert.ok(await f.admin.get('bookings/appointment'));
  assert.equal(f.removedPrefixes.length, 0);
  f.advance(180_001);
  for (let attempt = 0; attempt < 12 && (await deletion.status(job.jobId, job.jobToken)).status !== 'deleted'; attempt++) await deletion.process(job.jobId);
  assert.equal((await deletion.status(job.jobId, job.jobToken)).status, 'deleted');
  assert.ok(await f.admin.get('users/peer'));
});

test('large nested collections are fully removed across stable enumeration pages', async () => {
  const f = fixture(); const deletion = f.create();
  for (let index = 0; index < 235; index++) await f.admin.set(`messages/appointment/msgs/message-${String(index).padStart(3, '0')}`, { fromUid: 'peer' });
  for (let index = 0; index < 105; index++) await f.admin.set(`posts/own-post/comments/comment-${String(index).padStart(3, '0')}`, { fromUid: 'peer' });
  const job = await deletion.prepare(f.user()); await deletion.confirm(job.jobId, job.jobToken);
  for (let attempt = 0; attempt < 40 && (await deletion.status(job.jobId, job.jobToken)).status !== 'deleted'; attempt++) await deletion.process(job.jobId);
  assert.equal((await deletion.status(job.jobId, job.jobToken)).status, 'deleted');
  assert.equal([...f.admin.documents.keys()].filter(path => path.startsWith('messages/appointment/') || path.startsWith('posts/own-post/')).length, 0);
  assert.equal((await f.admin.list(`accountDeletionJobs/${job.jobId}/items`, 1000)).docs.length, 0);
  assert.ok(await f.admin.get('posts/peer-post'));
});

test('collection ID pagination and missing intermediate documents do not leave hidden descendants', async () => {
  const f = fixture(); const deletion = f.create();
  for (let index = 0; index < 105; index++) await f.admin.set(`users/owner/settings-${String(index).padStart(3, '0')}/missing/values/value`, { private: true });
  const job = await deletion.prepare(f.user()); await deletion.confirm(job.jobId, job.jobToken);
  for (let attempt = 0; attempt < 160 && (await deletion.status(job.jobId, job.jobToken)).status !== 'deleted'; attempt++) await deletion.process(job.jobId);
  assert.equal((await deletion.status(job.jobId, job.jobToken)).status, 'deleted');
  assert.equal([...f.admin.documents.keys()].filter(path => path.startsWith('users/owner/')).length, 0);
  assert.ok(await f.admin.get('users/peer'));
});

test('both participants can delete concurrently without removing each other resource tombstones', async () => {
  const f = fixture(); const deletion = f.create();
  const owner = await deletion.prepare(f.user());
  const peer = await deletion.prepare({ uid: 'peer', claims: { auth_time: f.time() / 1000 } });
  await deletion.confirm(owner.jobId, owner.jobToken); await deletion.confirm(peer.jobId, peer.jobToken);
  for (let attempt = 0; attempt < 20; attempt++) {
    await deletion.process(owner.jobId); await deletion.process(peer.jobId);
    if ((await deletion.status(owner.jobId, owner.jobToken)).status === 'deleted' && (await deletion.status(peer.jobId, peer.jobToken)).status === 'deleted') break;
  }
  assert.equal((await deletion.status(owner.jobId, owner.jobToken)).status, 'deleted');
  assert.equal((await deletion.status(peer.jobId, peer.jobToken)).status, 'deleted');
  assert.deepEqual(new Set(f.admin.deletedUsers), new Set(['owner', 'peer']));
  assert.deepEqual((await f.admin.get('accountDeletionBookingLocks/appointment')).data, { blocked: true });
});

test('an expired execution lease cannot overwrite a completed replacement worker', async () => {
  let time = 1_000_000;
  let releaseFirst;
  let entered;
  const firstEntered = new Promise(resolve => { entered = resolve; });
  const resumeFirst = new Promise(resolve => { releaseFirst = resolve; });
  let calls = 0;
  const admin = memoryAdmin({ 'users/owner': { uid: 'owner' } });
  const media = { removePrefixBatch: async (_bucket, _prefix, _limit, keepAlive) => {
    if (++calls === 1) { entered(); await resumeFirst; await keepAlive(); }
    return 0;
  } };
  const deletion = createDeletionService({ admin, media, now: () => time });
  const job = await deletion.prepare({ uid: 'owner', claims: { auth_time: time / 1000 } });
  await deletion.confirm(job.jobId, job.jobToken);
  const first = deletion.process(job.jobId);
  await firstEntered;
  time += 90_001;
  for (let attempt = 0; attempt < 12 && (await deletion.status(job.jobId, job.jobToken)).status !== 'deleted'; attempt++) await deletion.process(job.jobId);
  assert.equal((await deletion.status(job.jobId, job.jobToken)).status, 'deleted');
  releaseFirst(); await first;
  const completed = await admin.get(`accountDeletionJobs/${job.jobId}`);
  assert.equal(completed.data.state, 'completed');
  assert.equal(completed.data.pending, false);
  assert.equal(completed.data.failureCode, undefined);
  assert.deepEqual([...admin.deletedUsers], ['owner']);
});

test('existing signed upload grants are quarantined while new accounts need no legacy delay', async () => {
  const f = fixture(); const cutoff = f.time();
  const deletion = createDeletionService({ admin: f.admin, media: { removePrefixBatch: async () => 0 }, now: f.time, signedUploadCutoff: cutoff });
  const job = await deletion.prepare({ ...f.user(), createdAt: cutoff - 1 }); await deletion.confirm(job.jobId, job.jobToken);
  await deletion.process(job.jobId);
  assert.equal((await f.admin.get(`accountDeletionJobs/${job.jobId}`)).data.stage, 'wait-uploads');
  assert.equal(f.admin.deletedUsers.size, 0);
  f.advance(2 * 3600_000 + 1);
  for (let attempt = 0; attempt < 12 && (await deletion.status(job.jobId, job.jobToken)).status !== 'deleted'; attempt++) await deletion.process(job.jobId);
  assert.equal((await deletion.status(job.jobId, job.jobToken)).status, 'deleted');
  const other = fixture();
  const fresh = createDeletionService({ admin: other.admin, media: { removePrefixBatch: async () => 0 }, now: other.time, signedUploadCutoff: cutoff });
  const freshJob = await fresh.prepare({ ...other.user(), createdAt: cutoff + 1 }); await fresh.confirm(freshJob.jobId, freshJob.jobToken);
  for (let attempt = 0; attempt < 12 && (await fresh.status(freshJob.jobId, freshJob.jobToken)).status !== 'deleted'; attempt++) await fresh.process(freshJob.jobId);
  assert.equal((await fresh.status(freshJob.jobId, freshJob.jobToken)).status, 'deleted');
});

test('expired uncertain uploads are cleaned while completed and still active images are preserved', async () => {
  const time = 1_000_000;
  const admin = memoryAdmin({
    'mediaUploadOperations/uncertain': { bucket: 'halaqi-media', path: 'users/owner/a-unique.png', state: 'uploading', expiresAt: time - 1 },
    'mediaUploadOperations/completed': { bucket: 'halaqi-media', path: 'users/owner/saved.png', state: 'completed', expiresAt: time - 1 },
    'mediaUploadOperations/active': { bucket: 'halaqi-media', path: 'users/owner/active.png', state: 'uploading', expiresAt: time + 1 },
  });
  const discarded = [];
  const deletion = createDeletionService({ admin, media: { discardUpload: async (bucket, path) => { discarded.push({ bucket, path }); } }, now: () => time });
  await deletion.runPending();
  assert.deepEqual(discarded, [{ bucket: 'halaqi-media', path: 'users/owner/a-unique.png' }]);
  assert.equal(await admin.get('mediaUploadOperations/uncertain'), null);
  assert.equal(await admin.get('mediaUploadOperations/completed'), null);
  assert.ok(await admin.get('mediaUploadOperations/active'));
});
