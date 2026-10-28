import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaHandler } from './handler.ts';

const jwt = (sub = 'customer1', overrides = {}) => `header.${Buffer.from(JSON.stringify({
  aud: 'halaqyapp', iss: 'https://securetoken.google.com/halaqyapp', sub,
  iat: Math.floor(Date.now() / 1000), auth_time: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
})).toString('base64url')}.signature`;

function fixture({ identityOk = true, bookingAllowed = true } = {}) {
  let storageRequests = 0;
  const handler = createMediaHandler({
    projectUrl: 'https://storage.example.test', firebaseProjectId: 'halaqyapp', firebaseApiKey: 'public-fixture', getSecret: () => 'server-fixture',
    fetchImpl: async (url, init) => {
      if (url.includes('identitytoolkit.googleapis.com')) {
        const token = JSON.parse(init.body).idToken;
        const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        return identityOk ? Response.json({ users: [{ localId: claims.sub, validSince: '0' }] }) : Response.json({ error: { message: 'INVALID_ID_TOKEN' } }, { status: 400 });
      }
      if (url.includes('firestore.googleapis.com')) {
        return bookingAllowed
          ? Response.json({ fields: { customerUid: { stringValue: 'customer1' }, barberId: { stringValue: 'barber1' } } })
          : new Response(null, { status: 403 });
      }
      storageRequests++;
      return Response.json(url.includes('/object/sign/')
        ? { signedURL: '/object/sign/halaqi-chat/file?token=signed' }
        : { url: '/object/upload/sign/halaqi-media/file?token=upload' });
    },
  });
  const request = (token, body) => handler(new Request('https://storage.example.test/functions/v1/media', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body),
  }));
  return { handler, request, storageRequests: () => storageRequests };
}

test('the Edge endpoint rejects absent, expired and wrong-project credentials', async () => {
  const { request, storageRequests } = fixture();
  for (const token of [null, jwt('customer1', { exp: 1 }), jwt('customer1', { aud: 'other-project' })]) {
    assert.equal((await request(token, { action: 'upload' })).status, 401);
  }
  assert.equal(storageRequests(), 0);
});

test('decoded token claims cannot bypass Google verification', async () => {
  const { request, storageRequests } = fixture({ identityOk: false });
  assert.equal((await request(jwt(), { action: 'upload', path: 'users/customer1/a.png', size: 1, contentType: 'image/png' })).status, 401);
  assert.equal(storageRequests(), 0);
});

test('the JSON endpoint no longer grants long-lived signed upload permissions', async () => {
  const { request, storageRequests } = fixture();
  const image = { action: 'upload', path: 'users/customer1/a.png', size: 1, contentType: 'image/png' };
  assert.equal((await request(jwt('outsider'), image)).status, 400);
  assert.equal((await request(jwt(), image)).status, 400);
  assert.equal(storageRequests(), 0);
});

test('booking access is checked with Firestore rules before a private image link is signed', async () => {
  const denied = fixture({ bookingAllowed: false });
  const image = { action: 'download', bucket: 'halaqi-chat', path: 'chats/booking1/customer1-a.png' };
  assert.equal((await denied.request(jwt('outsider'), image)).status, 403);
  assert.equal(denied.storageRequests(), 0);
  const allowed = fixture();
  assert.equal((await allowed.request(jwt('barber1'), image)).status, 200);
});
