import { BackendError } from '../_shared/google-admin.mjs';

const queries = [
  ['bookings', 'customerUid'], ['bookings', 'barberId'], ['posts', 'ownerUid'],
  ['reviews', 'customerUid'], ['reviews', 'barberId'], ['notifications', 'toUid'], ['notifications', 'fromUid'],
  ['staff', 'salonOwnerId'], ['staff', 'barberId'], ['payouts', 'customerUid'], ['payouts', 'barberId'],
  ['checkins', 'customerUid'], ['referrals', 'inviterUid'], ['referrals', 'newUserUid'],
  ['follows', 'followerUid'], ['follows', 'barberId'], ['gallery', 'barberId'], ['gallery', 'ownerUid'],
  ['users', 'referredBy', 'unlink'],
  ['mediaUploadOperations', 'uid'],
];
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(value => value.toString(16).padStart(2, '0')).join('');

export function createDeletionService({ admin, media, now = Date.now, signedUploadCutoff = 0 }) {
  async function prepare(user) {
    const authTime = Number(user.claims.auth_time || 0) * 1000;
    if (!authTime || now() - authTime > 600_000 || authTime > now() + 60_000) {
      throw new BackendError('failed-precondition', 'Sign in again before deleting your account.');
    }
    if (await admin.get(`accountDeletionLocks/${user.uid}`)) throw new BackendError('already-exists', 'An account deletion request is already being processed.');
    const jobId = crypto.randomUUID();
    const jobToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    await admin.set(`accountDeletionJobs/${jobId}`, {
      uid: user.uid, tokenHash: await hash(jobToken), state: 'awaiting_confirmation', pending: false,
      createdAt: now(), expiresAt: now() + 15 * 60_000,
      accountCreatedAt: Number(user.createdAt || 0),
      mediaWaitUntil: signedUploadCutoff && Number(user.createdAt || 0) <= signedUploadCutoff ? signedUploadCutoff + 2 * 3600_000 : 0,
    }, { exists: false });
    return { jobId, jobToken, status: 'awaiting_confirmation' };
  }

  async function authorizedJob(jobId, token) {
    if (typeof jobId !== 'string' || !/^[a-f0-9-]{36}$/i.test(jobId) || typeof token !== 'string' || token.length < 64 || token.length > 128) {
      throw new BackendError('permission-denied', 'Invalid deletion request.');
    }
    const job = await admin.get(`accountDeletionJobs/${jobId}`);
    if (!job) throw new BackendError('not-found', 'The deletion status has expired.');
    if (job.data.tokenHash !== await hash(token)) throw new BackendError('permission-denied', 'Invalid deletion request.');
    return job;
  }

  async function confirm(jobId, token) {
    const job = await authorizedJob(jobId, token);
    if (job.data.state === 'completed') return { status: 'deleted' };
    if (job.data.state === 'failed') {
      await admin.set(job.path, { pending: true, state: 'queued', nextAttemptAt: 0, failures: 0, leaseUntil: 0 }, {
        fields: ['pending', 'state', 'nextAttemptAt', 'failures', 'leaseUntil'], updateTime: job.updateTime,
      });
      return { status: 'pending' };
    }
    if (job.data.state !== 'awaiting_confirmation') return { status: 'pending' };
    if (job.data.expiresAt < now()) throw new BackendError('failed-precondition', 'Sign in again and submit a new deletion request.');
    const data = { uid: job.data.uid, tokenHash: job.data.tokenHash, createdAt: job.data.createdAt,
      accountCreatedAt: job.data.accountCreatedAt || 0,
      mediaWaitUntil: job.data.mediaWaitUntil || 0,
      pending: true, state: 'queued', stage: 'collect', collectIndex: -1, nextAttemptAt: 0, failures: 0, leaseUntil: 0 };
    await admin.commit([
      admin.updateWrite(`accountDeletionLocks/${job.data.uid}`, { jobId, createdAt: now() }, { exists: false }),
      admin.updateWrite(job.path, data, { updateTime: job.updateTime }),
    ]);
    return { status: 'pending' };
  }

  async function status(jobId, token) {
    const job = await authorizedJob(jobId, token);
    return { status: job.data.state === 'completed' ? 'deleted' : job.data.state === 'failed' ? 'failed' : 'pending' };
  }

  function leaseContext(job, leaseId) {
    async function current() {
      const value = await admin.get(job.path);
      if (!value?.data.pending || value.data.leaseId !== leaseId) throw new BackendError('lease-lost', 'Deletion execution changed.');
      return value;
    }
    async function commit(writes = [], patch = {}) {
      const value = await current();
      const heartbeat = { leaseUntil: now() + 90_000, ...patch };
      await admin.commit([...writes, admin.updateWrite(job.path, heartbeat, { fields: Object.keys(heartbeat), updateTime: value.updateTime })]);
    }
    return { current, commit, renew: () => commit() };
  }

  async function addItems(jobPath, items, context) {
    const unique = new Map();
    for (const item of items) unique.set(await hash(`${item.kind}:${item.bucket || ''}:${item.path}`), item);
    const entries = [...unique.entries()];
    for (let index = 0; index < entries.length; index += 200) {
      await context.commit(entries.slice(index, index + 200).map(([id, item]) => admin.updateWrite(`${jobPath}/items/${id}`, item)));
    }
  }

  async function collect(job, deadline, context) {
    const uid = job.data.uid;
    let index = job.data.collectIndex ?? -1;
    let cursor = job.data.collectCursor || '';
    if (index === -1) {
      await context.renew();
      await admin.authUpdate(uid, { disableUser: true, validSince: String(Math.floor(now() / 1000)) });
      await addItems(job.path, [
        ...['users', 'barbers', 'devices'].map(kind => ({ kind: 'tree', path: `${kind}/${uid}` })),
        ...['users', 'barbers', 'posts'].flatMap(kind => [
          { kind: 'media', bucket: 'halaqi-media', path: `${kind}/${uid}` },
          { kind: 'legacy', path: `${kind}/${uid}` },
        ]),
      ], context);
      index = 0;
    }
    while (index < queries.length && now() < deadline) {
      const [collection, field, type] = queries[index];
      await context.renew();
      const docs = await admin.query(collection, field, uid, 100, cursor || undefined);
      const items = docs.map(doc => ({ kind: type || 'tree', path: doc.path, referencesUid: !type }));
      if (['bookings', 'posts'].includes(collection) && docs.length) {
        const locks = [];
        for (const document of docs) {
          const id = document.path.split('/').at(-1);
          const lockPath = `${collection === 'bookings' ? 'accountDeletionBookingLocks' : 'accountDeletionPostLocks'}/${id}`;
          locks.push(admin.updateWrite(lockPath, { jobId: job.path.split('/').at(-1), createdAt: now() }),
            admin.updateWrite(`${job.path}/locks/${await hash(lockPath)}`, { path: lockPath }));
        }
        await context.commit(locks);
      }
      if (collection === 'bookings') {
        for (const document of docs) {
          const bookingId = document.path.split('/').at(-1);
          items.push({ kind: 'tree', path: `messages/${bookingId}` },
            { kind: 'media', bucket: 'halaqi-chat', path: `chats/${bookingId}` },
            { kind: 'legacy', path: `chats/${bookingId}` });
        }
      }
      await addItems(job.path, items, context);
      if (docs.length < 100) { index++; cursor = ''; } else cursor = docs.at(-1).path;
      await context.commit([], { collectIndex: index, collectCursor: cursor });
    }
    if (index >= queries.length) {
      await context.commit([], { stage: 'wait-uploads' });
      job.data.stage = 'wait-uploads';
    }
  }

  async function processItem(job, item, context) {
    const data = item.data;
    await context.renew();
    if (data.kind === 'media') return (await media.removePrefixBatch(data.bucket, data.path, 50, context.renew)) < 50;
    if (data.kind === 'legacy') return (await admin.deleteLegacyPrefix('halaqyapp.firebasestorage.app', data.path, context.renew)) < 50;
    if (data.kind === 'unlink') {
      const target = await admin.get(data.path);
      if (target?.data.referredBy === job.data.uid) await context.commit([admin.updateWrite(data.path, {}, { fields: ['referredBy'], updateTime: target.updateTime })]);
      return true;
    }
    if (data.kind !== 'tree') throw new BackendError('internal', 'Invalid deletion item.');
    const target = await admin.get(data.path);
    const referenceFields = ['uid', 'ownerUid', 'customerUid', 'barberId', 'toUid', 'fromUid', 'salonOwnerId', 'inviterUid', 'newUserUid', 'followerUid'];
    if (data.referencesUid && target && !referenceFields.some(field => target.data[field] === job.data.uid)) return true;
    if (!data.enumerating) {
      const children = await admin.collections(data.path, data.collectionToken || undefined);
      await context.commit([admin.updateWrite(item.path, { ...data, enumerating: true,
        collections: children.collectionIds || [], collectionIndex: 0, pageToken: '', nextCollectionToken: children.nextPageToken || '' })]);
      return false;
    }
    const collection = data.collections?.[data.collectionIndex || 0];
    if (collection) {
      const page = await admin.list(`${data.path}/${collection}`, 100, data.pageToken || undefined);
      await addItems(job.path, page.docs.map(doc => ({ kind: 'tree', path: doc.path })), context);
      await context.commit([admin.updateWrite(item.path, { ...data,
        pageToken: page.nextPageToken || '', collectionIndex: (data.collectionIndex || 0) + (page.nextPageToken ? 0 : 1) })]);
      return false;
    }
    if (data.nextCollectionToken) {
      await context.commit([admin.updateWrite(item.path, { ...data, enumerating: false, collectionToken: data.nextCollectionToken })]);
      return false;
    }
    await context.commit([{ delete: admin.fullName(data.path), ...(target?.updateTime ? { currentDocument: { updateTime: target.updateTime } } : {}) }]);
    return true;
  }

  async function process(jobId, budget = 40_000) {
    const path = `accountDeletionJobs/${jobId}`;
    const job = await admin.get(path);
    if (!job?.data.pending || job.data.nextAttemptAt > now() || job.data.leaseUntil > now()) return;
    const leaseId = crypto.randomUUID();
    try {
      await admin.set(path, { state: 'running', leaseId, leaseUntil: now() + 90_000 }, { fields: ['state', 'leaseId', 'leaseUntil'], updateTime: job.updateTime });
    } catch (error) { if (error.code === 'aborted') return; throw error; }
    const deadline = now() + budget;
    const context = leaseContext(job, leaseId);
    try {
      if (job.data.stage === 'collect') await collect(job, deadline, context);
      if (job.data.stage === 'wait-uploads' && now() < deadline) {
        const active = await admin.activeUploads(job.data.uid, now());
        const previousGrantsUntil = signedUploadCutoff && Number(job.data.accountCreatedAt || 0) <= signedUploadCutoff ? signedUploadCutoff + 2 * 3600_000 : 0;
        if (active || Math.max(job.data.mediaWaitUntil || 0, previousGrantsUntil) > now()) {
          await context.commit([], { state: 'queued', leaseUntil: 0, leaseId: '', nextAttemptAt: now() + 3000 });
          return;
        }
        await context.commit([], { stage: 'cleanup' }); job.data.stage = 'cleanup';
      }
      if (job.data.stage === 'cleanup' && now() < deadline) {
        const items = await admin.list(`${path}/items`, 100);
        for (const item of items.docs) {
          if (now() > deadline) break;
          if (await processItem(job, item, context)) await context.commit([{ delete: admin.fullName(item.path) }]);
        }
        if (!(await admin.list(`${path}/items`, 1)).docs.length) {
          await context.renew();
          await admin.authDelete(job.data.uid);
          let lockPage;
          do {
            lockPage = await admin.list(`${path}/locks`, 100);
            if (lockPage.docs.length) await context.commit(lockPage.docs.flatMap(lock => [
              // Resource IDs stay blocked without retaining any account UID;
              // another participant's slower deletion may still be using them.
              admin.updateWrite(lock.data.path, { blocked: true }),
              { delete: admin.fullName(lock.path) },
            ]));
          } while (lockPage.docs.length);
          // Keep only a short-lived security marker until old Firebase ID
          // tokens have expired; it prevents deleted data from being recreated.
          const finalJob = await context.current();
          await admin.commit([
            admin.updateWrite(`accountDeletionLocks/${job.data.uid}`, { state: 'completed', expiresAt: now() + 2 * 3600_000 }),
            admin.updateWrite(path, { tokenHash: job.data.tokenHash, state: 'completed', pending: false, completedAt: now(), expiresAt: now() + 24 * 3600_000 }, { updateTime: finalJob.updateTime }),
          ]);
          return;
        }
      }
      await context.commit([], { state: 'queued', leaseUntil: 0, leaseId: '', nextAttemptAt: 0 });
    } catch (error) {
      if (error?.code === 'lease-lost') return;
      console.error('account_deletion_retry', { jobId, code: error?.code || 'unknown', status: error?.status || 0 });
      const failures = Number(job.data.failures || 0) + 1;
      await context.commit([], { failures, state: failures >= 10 ? 'failed' : 'retry', pending: failures < 10,
        leaseUntil: 0, leaseId: '', nextAttemptAt: now() + Math.min(3600_000, 30_000 * 2 ** Math.min(failures, 6)),
        failureCode: error?.code || 'unknown', failureStatus: error?.status || 0 }).catch(() => {});
    }
  }

  async function runPending() {
    for (const operation of await admin.expired('mediaUploadOperations', now(), 30)) {
      try {
        if (operation.data.state !== 'completed') await media.discardUpload(operation.data.bucket, operation.data.path);
        await admin.remove(operation.path);
      } catch { console.error('expired_upload_cleanup_retry_required'); }
    }
    const jobs = await admin.due('accountDeletionJobs', 'pending', now(), 3);
    for (const job of jobs) await process(job.path.split('/').at(-1), 20_000);
    for (const collection of ['accountDeletionJobs', 'accountDeletionLocks']) {
      for (const document of await admin.expired(collection, now(), 30)) {
        if (collection !== 'accountDeletionJobs' && document.data.state !== 'completed') continue;
        if (collection === 'accountDeletionJobs' && !['completed', 'awaiting_confirmation'].includes(document.data.state)) continue;
        await admin.remove(document.path);
      }
    }
    return { checked: jobs.length };
  }
  return { prepare, confirm, status, process, runPending };
}
