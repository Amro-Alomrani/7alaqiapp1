import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaStorage } from './media-storage.mjs';

function fixture(responder = () => ({ url: '/object/upload/sign/halaqi-media/file?token=test-upload-token' })) {
  const requests = [];
  const storage = createMediaStorage({
    projectUrl: 'https://storage.example.test',
    getSecret: () => 'server-only-fixture',
    getBooking: async id => id === 'booking1' ? { customerUid: 'customer1', barberId: 'barber1' } : null,
    fetchImpl: async (url, init) => {
      requests.push({ url, ...init });
      return Response.json(responder(url, init));
    },
  });
  return { storage, requests };
}

test('only the authenticated owner can obtain upload permission for public media', async () => {
  const { storage, requests } = fixture();
  const upload = { path: 'users/customer1/avatar.png', size: 100, contentType: 'image/png' };
  await assert.rejects(storage.createUpload('', upload), { code: 'unauthenticated' });
  await assert.rejects(storage.createUpload('outsider', upload), { code: 'permission-denied' });
  await assert.rejects(storage.createUpload('customer1', { ...upload, path: 'users/customer1/../outsider/a.png' }), { code: 'invalid-argument' });
  assert.equal(requests.length, 0);
  const result = await storage.createUpload('customer1', upload);
  assert.equal(result.bucket, 'halaqi-media');
  assert.equal(result.path, upload.path);
  assert.equal(result.token, 'test-upload-token');
  assert.equal(requests[0].headers.apikey, 'server-only-fixture');
  assert.equal(requests[0].headers.Authorization, undefined);
});

test('booking participants can read both chat images but only upload or delete their own', async () => {
  const { storage, requests } = fixture(url => url.includes('/object/sign/')
    ? { signedURL: '/object/sign/halaqi-chat/chats/booking1/customer1-a.png?token=signed' }
    : { url: '/object/upload/sign/halaqi-chat/file?token=upload' });
  const image = { bucket: 'halaqi-chat', path: 'chats/booking1/customer1-a.png', size: 100, contentType: 'image/png' };
  await assert.rejects(storage.createUpload('outsider', image), { code: 'permission-denied' });
  await assert.rejects(storage.createUpload('barber1', image), { code: 'permission-denied' });
  await assert.rejects(storage.remove('barber1', image), { code: 'permission-denied' });
  await assert.rejects(storage.createDownload('outsider', image), { code: 'permission-denied' });
  assert.equal(requests.length, 0);
  assert.match((await storage.createDownload('barber1', image)).url, /^https:\/\/storage\.example\.test\/storage\/v1\/object\/sign\//);
  await storage.createUpload('customer1', image);
  await storage.remove('customer1', image);
  assert.deepEqual(JSON.parse(requests.at(-1).body), { prefixes: [image.path] });
});

test('non-images, empty images and oversized files receive no signed permission', async () => {
  const { storage, requests } = fixture();
  for (const details of [
    { size: 0, contentType: 'image/png' },
    { size: 10 * 1024 * 1024 + 1, contentType: 'image/png' },
    { size: 100, contentType: 'text/html' },
  ]) {
    await assert.rejects(storage.createUpload('customer1', { path: 'users/customer1/a.png', ...details }), { code: 'invalid-argument' });
  }
  assert.equal(requests.length, 0);
});

test('account cleanup enumerates nested objects and deletes exact file names, never directory prefixes', async () => {
  const removed = [];
  const { storage } = fixture((url, init) => {
    const body = JSON.parse(init.body);
    if (url.includes('/object/list/')) {
      if (body.prefix === 'barbers/customer1') return [{ name: 'avatar.png', id: 'file1' }, { name: 'staff', id: null }];
      if (body.prefix === 'barbers/customer1/staff') return [{ name: 'person.png', id: 'file2' }];
      if (body.prefix === 'chats/booking1') return [{ name: 'customer1-a.png', id: 'file3' }];
      return [];
    }
    removed.push(...body.prefixes);
    return [];
  });
  await storage.removeAccountMedia('customer1', ['booking1', 'booking1']);
  assert.deepEqual(removed.sort(), ['barbers/customer1/avatar.png', 'barbers/customer1/staff/person.png', 'chats/booking1/customer1-a.png'].sort());
});

test('storage failures never reveal backend response bodies or credentials', async () => {
  const storage = createMediaStorage({
    projectUrl: 'https://storage.example.test', getSecret: () => 'fixture-private-key', getBooking: async () => null,
    fetchImpl: async () => new Response('sensitive-provider-debug-text', { status: 403 }),
  });
  await assert.rejects(storage.createUpload('customer1', { path: 'users/customer1/a.png', size: 1, contentType: 'image/png' }), error => {
    assert.equal(error.code, 'unavailable');
    assert.doesNotMatch(error.message, /fixture-private-key|sensitive-provider-debug-text/);
    return true;
  });
});
