import { BackendError, createGoogleAdmin } from '../_shared/google-admin.mjs';
import { MediaStorageError, createMediaStorage } from '../../../functions/media-storage.mjs';
import { verifyFirebaseUser } from '../_shared/firebase-user.ts';
import { createDeletionService } from './deletion.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-halaqi-job-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

export function createBackendHandler(options: {
  admin: ReturnType<typeof createGoogleAdmin>; media: ReturnType<typeof createMediaStorage>; getJobToken: () => string;
  firebaseProjectId: string; firebaseApiKey: string;
  schedule: (task: Promise<unknown>) => void;
  fetchImpl?: typeof fetch;
  signedUploadCutoff?: number;
}) {
  const deletion = createDeletionService({ admin: options.admin, media: options.media, signedUploadCutoff: options.signedUploadCutoff || 0 });
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });
  const background = (task: Promise<unknown>) => options.schedule(task.catch(() => { console.error('backend_background_retry_required'); }));
  async function dispatchPushes(limit = 10) {
    const pending = await options.admin.due('notifications', 'pushPending', Date.now(), limit);
    let delivered = 0;
    for (const item of pending) {
      const current = await options.admin.get(item.path);
      if (!current?.data.pushPending || current.data.leaseUntil > Date.now()) continue;
      const leaseUntil = Date.now() + 60_000;
      try {
        await options.admin.set(item.path, { leaseUntil }, { fields: ['leaseUntil'], updateTime: current.updateTime });
        const recipient = await options.admin.get(`users/${item.data.toUid}`) || await options.admin.get(`barbers/${item.data.toUid}`);
        const token = typeof recipient?.data.fcmToken === 'string' ? recipient.data.fcmToken.trim() : '';
        if (!token) {
          await options.admin.set(item.path, { pushPending: false, pushStatus: 'no_device', leaseUntil: 0 }, { fields: ['pushPending', 'pushStatus', 'leaseUntil'] });
          continue;
        }
        const data: Record<string, string> = { notificationId: item.path.split('/').at(-1) || '', type: String(item.data.type || '') };
        for (const key of ['bookingId', 'postId']) if (typeof item.data[key] === 'string') data[key] = item.data[key];
        await options.admin.sendPush({ token, notification: { title: item.data.title, body: item.data.body }, data, android: { priority: 'high' }, apns: { payload: { aps: { sound: 'default' } } } });
        await options.admin.set(item.path, { pushPending: false, pushStatus: 'accepted', pushedAt: Date.now(), leaseUntil: 0 }, { fields: ['pushPending', 'pushStatus', 'pushedAt', 'leaseUntil'] });
        delivered++;
      } catch (error) {
        const attempts = Number(item.data.pushAttempts || 0) + 1;
        await options.admin.set(item.path, { pushAttempts: attempts, nextAttemptAt: Date.now() + Math.min(3600_000, 5000 * 2 ** Math.min(attempts, 6)), leaseUntil: 0, pushStatus: 'retrying' }, { fields: ['pushAttempts', 'nextAttemptAt', 'leaseUntil', 'pushStatus'] }).catch(() => {});
        if (error instanceof BackendError && error.fcmCode === 'UNREGISTERED') {
          await options.admin.set(item.path, { pushPending: false, pushStatus: 'invalid_device', leaseUntil: 0 }, { fields: ['pushPending', 'pushStatus', 'leaseUntil'] }).catch(() => {});
        }
      }
    }
    return { checked: pending.length, accepted: delivered };
  }

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: { code: 'invalid-argument', message: 'POST is required.' } }, 405);
    try {
      const text = await request.text();
      if (text.length > 16_384) throw new BackendError('invalid-argument', 'Request is too large.');
      let body;
      try { body = JSON.parse(text); } catch { throw new BackendError('invalid-argument', 'A valid request is required.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BackendError('invalid-argument', 'A valid request is required.');
      if (['dispatch-pending', 'runtime-check'].includes(body.action)) {
        const expected = options.getJobToken();
        const actual = request.headers.get('x-halaqi-job-token');
        if (!expected || expected.length < 32 || actual !== expected) throw new BackendError('permission-denied', 'Worker access denied.');
        if (body.action === 'runtime-check') {
          await options.admin.get('_backendHealth/nonexistent');
          return json({ configured: true, firestoreAccess: true });
        }
        return json({ deletion: await deletion.runPending(), pushes: await dispatchPushes() });
      }
      if (body.action === 'confirm-account-deletion') {
        const result = await deletion.confirm(body.jobId, body.jobToken);
        background(deletion.process(body.jobId));
        return json(result);
      }
      if (body.action === 'account-deletion-status') {
        const result = await deletion.status(body.jobId, body.jobToken);
        if (result.status === 'pending') background(deletion.process(body.jobId, 20_000));
        return json(result);
      }
      const user = await verifyFirebaseUser(request, options);
      if (body.action === 'prepare-account-deletion') return json(await deletion.prepare(user));
      throw new BackendError('invalid-argument', 'Unknown operation.');
    } catch (error) {
      if (error instanceof BackendError || error instanceof MediaStorageError) {
        const statuses: Record<string, number> = { unauthenticated: 401, 'permission-denied': 403, 'invalid-argument': 400, 'not-found': 404, 'failed-precondition': 409, 'already-exists': 409, aborted: 409, unavailable: 503 };
        return json({ error: { code: error.code, message: error.message } }, statuses[error.code] || 500);
      }
      return json({ error: { code: 'unavailable', message: 'The request could not be completed. Retry shortly.' } }, 503);
    }
  };
}
