import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackendHandler } from './handler.ts';
import { BackendError } from '../_shared/google-admin.mjs';
import { memoryAdmin } from './test-admin.mjs';

function fixture(seed = {}) {
  const admin = memoryAdmin({
    'notifications/n1': { toUid: 'barber', fromUid: 'customer', type: 'booking_request', bookingId: 'booking', title: 'Booking', body: 'Request', pushPending: true, nextAttemptAt: 0, pushAttempts: 0 },
    'users/barber': { role: 'barber' },
    'barbers/barber': { fcmToken: 'fixture-native-token' }, ...seed,
  });
  const sent = []; admin.sendPush = async message => { sent.push(message); };
  const token = 'worker-fixture-'.repeat(4);
  const handler = createBackendHandler({ admin, media: { discardUpload: async () => {} }, getJobToken: () => token, firebaseProjectId: 'fixture', firebaseApiKey: 'fixture', schedule: () => {} });
  return { admin, sent, dispatch: () => handler(new Request('https://fixture.test/backend', { method: 'POST', headers: { 'x-halaqi-job-token': token }, body: JSON.stringify({ action: 'dispatch-pending' }) })) };
}

test('barber push uses the barber token even when the user profile exists without one', async () => {
  const f = fixture(); assert.equal((await f.dispatch()).status, 200);
  assert.equal(f.sent[0].token, 'fixture-native-token');
  assert.equal(f.sent[0].android.notification.tag, 'n1');
  assert.equal((await f.admin.get('notifications/n1')).data.pushStatus, 'accepted');
});
test('a competing worker lease is not overwritten by the losing worker', async () => {
  const f = fixture(); const set = f.admin.set;
  f.admin.set = async (path, data, options) => {
    if (data.leaseId) { await set(path, { leaseId: 'other-worker', leaseUntil: Date.now() + 90000 }, { fields: ['leaseId', 'leaseUntil'] }); throw new BackendError('aborted', 'Concurrent worker'); }
    return set(path, data, options);
  };
  await f.dispatch(); assert.equal(f.sent.length, 0);
  assert.equal((await f.admin.get('notifications/n1')).data.leaseId, 'other-worker');
});
test('notifications are not sent to an account being removed', async () => {
  const f = fixture({ 'accountDeletionLocks/barber': { jobId: 'deleting' } });
  await f.dispatch(); assert.equal(f.sent.length, 0);
  assert.equal((await f.admin.get('notifications/n1')).data.pushStatus, 'account_removed');
});
test('failed FCM delivery retries rather than claiming delivery, then stops after a bounded number', async () => {
  const f = fixture(); f.admin.sendPush = async () => { throw new BackendError('unavailable', 'Temporary failure'); };
  await f.dispatch(); let data = (await f.admin.get('notifications/n1')).data;
  assert.equal(data.pushStatus, 'retrying'); assert.equal(data.pushPending, true);
  await f.admin.set('notifications/n1', { pushAttempts: 7, nextAttemptAt: 0 }, { fields: ['pushAttempts', 'nextAttemptAt'] });
  await f.dispatch(); data = (await f.admin.get('notifications/n1')).data;
  assert.equal(data.pushStatus, 'failed'); assert.equal(data.pushPending, false);
});
