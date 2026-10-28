import test from 'node:test';
import assert from 'node:assert/strict';
import { createUploadHandler } from './upload.ts';
import { memoryAdmin } from '../backend/test-admin.mjs';

const jwt = (sub = 'customer1') => `header.${Buffer.from(JSON.stringify({
  aud: 'halaqyapp', iss: 'https://securetoken.google.com/halaqyapp', sub,
  iat: Math.floor(Date.now() / 1000), auth_time: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
})).toString('base64url')}.signature`;

function fixture({ seed = {}, onUpload = async () => {}, rejectUpload = false } = {}) {
  const admin = memoryAdmin({ 'bookings/booking1': { customerUid: 'customer1', barberId: 'barber1' }, ...seed });
  const uploads = []; const discards = [];
  const handler = createUploadHandler({
    admin, projectUrl: 'https://storage.example.test', firebaseProjectId: 'halaqyapp', firebaseApiKey: 'public-fixture', getSecret: () => 'server-fixture',
    fetchImpl: async (url, init) => {
      if (url.includes('identitytoolkit.googleapis.com')) {
        const token = JSON.parse(init.body).idToken;
        const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        return Response.json({ users: [{ localId: claims.sub, validSince: '0' }] });
      }
      assert.ok(url.includes('/storage/v1/object/'));
      if (init.method === 'DELETE') { discards.push(JSON.parse(init.body)); return Response.json({}); }
      uploads.push({ url, method: init.method, bytes: init.body.byteLength, operations: (await admin.list('mediaUploadOperations', 1000)).docs });
      await onUpload(admin);
      return rejectUpload ? Response.json({ error: 'Storage offline' }, { status: 503 }) : Response.json({ Key: 'uploaded' });
    },
  });
  const request = (uid = 'customer1', path = 'users/customer1/a.png', body = new Uint8Array([1, 2, 3]), type = 'image/png') => handler(new Request(`https://storage.example.test/functions/v1/media?upload=1&path=${encodeURIComponent(path)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${jwt(uid)}`, 'Content-Type': type }, body,
  }));
  return { admin, uploads, discards, request };
}

test('own public upload is tracked before storage writes and returns a stable public URL', async () => {
  const f = fixture(); const response = await f.request();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.bucket, 'halaqi-media');
  assert.match(result.path, /^users\/customer1\/a-[a-f0-9-]{36}\.png$/);
  assert.equal(result.url, `https://storage.example.test/storage/v1/object/public/halaqi-media/${result.path}`);
  assert.equal(f.uploads.length, 1);
  assert.equal(f.uploads[0].bytes, 3);
  assert.equal(f.uploads[0].operations.length, 1);
  assert.deepEqual(f.uploads[0].operations[0].data.relatedUids, ['customer1']);
  assert.ok(f.uploads[0].operations[0].data.expiresAt > Date.now());
  assert.equal((await f.admin.list('mediaUploadOperations')).docs.length, 0);
  assert.equal(f.discards.length, 0);
});

test('private uploads track both booking participants and return a private reference', async () => {
  const f = fixture(); const response = await f.request('barber1', 'chats/booking1/barber1-a.png');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.match(result.path, /^chats\/booking1\/barber1-a-[a-f0-9-]{36}\.png$/);
  assert.equal(result.url, `supabase-storage://halaqi-chat/${result.path}`);
  assert.deepEqual(new Set(f.uploads[0].operations[0].data.relatedUids), new Set(['customer1', 'barber1']));
});

test('another account folder, outsider booking access, and peer file overwrite are denied before uploading', async () => {
  for (const [uid, path] of [['outsider', 'users/customer1/a.png'], ['outsider', 'chats/booking1/outsider-a.png'], ['barber1', 'chats/booking1/customer1-a.png']]) {
    const f = fixture(); const response = await f.request(uid, path);
    assert.equal(response.status, 403, path);
    assert.equal(f.uploads.length, 0);
    assert.equal((await f.admin.list('mediaUploadOperations')).docs.length, 0);
  }
});

test('deletion locks atomically deny uploads for the user, booking peer, or retired booking', async () => {
  for (const path of ['accountDeletionLocks/customer1', 'accountDeletionLocks/barber1', 'accountDeletionBookingLocks/booking1']) {
    const f = fixture({ seed: { [path]: { blocked: true } } });
    const response = await f.request('customer1', 'chats/booking1/customer1-a.png');
    assert.equal(response.status, 409, path);
    assert.equal(f.uploads.length, 0);
    assert.equal((await f.admin.list('mediaUploadOperations')).docs.length, 0);
  }
});

test('a participant beginning deletion mid-transfer causes the uploaded object to be discarded', async () => {
  const f = fixture({ onUpload: admin => admin.set('accountDeletionLocks/barber1', { blocked: true }) });
  const response = await f.request('customer1', 'chats/booking1/customer1-a.png');
  assert.equal(response.status, 403);
  assert.equal(f.uploads.length, 1);
  assert.deepEqual(f.discards, [{ prefixes: [f.uploads[0].operations[0].data.path] }]);
  assert.equal((await f.admin.list('mediaUploadOperations')).docs.length, 1);
});

test('empty, oversized and nonimage input never reaches image storage', async () => {
  for (const [body, type] of [[new Uint8Array(), 'image/png'], [new Uint8Array(10 * 1024 * 1024 + 1), 'image/png'], [new Uint8Array([1]), 'text/plain']]) {
    const f = fixture();
    assert.equal((await f.request('customer1', 'users/customer1/a.png', body, type)).status, 400);
    assert.equal(f.uploads.length, 0);
  }
});

test('an uncertain storage failure retains a bounded in-flight operation for background cleanup', async () => {
  const f = fixture({ rejectUpload: true });
  assert.equal((await f.request()).status, 503);
  const operations = (await f.admin.list('mediaUploadOperations')).docs;
  assert.equal(operations.length, 1);
  assert.equal(operations[0].data.state, 'uploading');
  assert.match(operations[0].data.path, /^users\/customer1\/a-[a-f0-9-]{36}\.png$/);
  assert.ok(operations[0].data.expiresAt <= Date.now() + 180_000);
});

test('repeated requested filenames use independent objects so failed cleanup cannot delete an earlier image', async () => {
  const f = fixture();
  const first = await f.request(); const second = await f.request();
  const a = await first.json(); const b = await second.json();
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.notEqual(a.path, b.path);
  assert.ok(a.path.startsWith('users/customer1/a-'));
  assert.ok(b.path.startsWith('users/customer1/a-'));
});
