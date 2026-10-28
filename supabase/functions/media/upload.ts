import { createMediaStorage, MediaStorageError } from '../../../functions/media-storage.mjs';
import { BackendError, createGoogleAdmin } from '../_shared/google-admin.mjs';
import { verifyFirebaseUser } from '../_shared/firebase-user.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };

async function readImage(request: Request): Promise<Uint8Array> {
  if (Number(request.headers.get('Content-Length') || 0) > 10 * 1024 * 1024 || !request.body) throw new MediaStorageError('invalid-argument', 'Choose an image up to 10 MB.');
  const reader = request.body.getReader();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel(); }, 45_000);
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (timedOut) throw new MediaStorageError('unavailable', 'Image upload timed out.');
      if (result.done) break;
      total += result.value.byteLength;
      if (total > 10 * 1024 * 1024) { await reader.cancel(); throw new MediaStorageError('invalid-argument', 'Choose an image up to 10 MB.'); }
      chunks.push(result.value);
    }
  } finally { clearTimeout(timeout); }
  if (!total) throw new MediaStorageError('invalid-argument', 'The selected image is empty.');
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export function createUploadHandler(options: {
  admin: ReturnType<typeof createGoogleAdmin>; projectUrl: string; getSecret: () => string;
  firebaseProjectId: string; firebaseApiKey: string; fetchImpl?: typeof fetch;
}) {
  const media = createMediaStorage({ ...options, getBooking: async (id: string) => (await options.admin.get(`bookings/${id}`))?.data || null });
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let operationPath = ''; let attempted = false; let completed = false; let uploaded = false;
    let target: Awaited<ReturnType<typeof media.validateUploadPath>> | undefined;
    try {
      if (request.method !== 'POST') throw new MediaStorageError('invalid-argument', 'POST is required.');
      const user = await verifyFirebaseUser(request, options);
      const requestedPath = new URL(request.url).searchParams.get('path') || '';
      await media.validateUploadPath(user.uid, requestedPath);
      const operationId = crypto.randomUUID();
      // A failed/uncertain transfer can only clean up its own new object,
      // never an image from an earlier upload to the caller's requested path.
      const path = requestedPath.replace(/(\.[^/.]+)?$/, `-${operationId}$1`);
      target = await media.validateUploadPath(user.uid, path);
      const relatedUids = [...new Set([user.uid, ...(target.participants || [])])];
      operationPath = `mediaUploadOperations/${operationId}`;
      // Deleting an absent document with exists:false is an atomic assertion:
      // it cannot remove an existing deletion lock or race past its creation.
      const checks = relatedUids.map(uid => ({ delete: options.admin.fullName(`accountDeletionLocks/${uid}`), currentDocument: { exists: false } }));
      if (target.bucket === 'halaqi-chat') checks.push({ delete: options.admin.fullName(`accountDeletionBookingLocks/${target.parts[1]}`), currentDocument: { exists: false } });
      await options.admin.commit([...checks, options.admin.updateWrite(operationPath,
        { uid: user.uid, relatedUids, bucket: target.bucket, path, state: 'uploading', expiresAt: Date.now() + 180_000 }, { exists: false })]);
      const bytes = await readImage(request);
      attempted = true;
      await media.uploadFile(user.uid, { path, contentType: request.headers.get('Content-Type') || '', bytes });
      uploaded = true;
      for (const uid of relatedUids) {
        if (await options.admin.get(`accountDeletionLocks/${uid}`)) {
          await media.discardUpload(target.bucket, path); uploaded = false;
          throw new MediaStorageError('permission-denied', 'The account or booking is being removed.');
        }
      }
      await options.admin.set(operationPath, { state: 'completed' }, { fields: ['state'] });
      completed = true;
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const url = target.bucket === 'halaqi-chat' ? `supabase-storage://${target.bucket}/${path}` : `${options.projectUrl}/storage/v1/object/public/${target.bucket}/${encoded}`;
      return Response.json({ bucket: target.bucket, path, url }, { headers: cors });
    } catch (error) {
      if (uploaded && target) { try { await media.discardUpload(target.bucket, target.path); uploaded = false; } catch { /* The tracked operation remains for background cleanup. */ } }
      const code = error instanceof MediaStorageError || error instanceof BackendError ? error.code : 'unavailable';
      const statuses: Record<string, number> = { unauthenticated: 401, 'permission-denied': 403, 'invalid-argument': 400, aborted: 409 };
      return Response.json({ error: { code, message: 'The image could not be uploaded. Retry shortly.' } }, { status: statuses[code] || 503, headers: cors });
    } finally {
      if (operationPath && (completed || !attempted)) await options.admin.remove(operationPath).catch(() => {});
      // Failed/uncertain transfers keep their short lease so deletion waits
      // until no upload can still commit; the worker then removes remnants.
    }
  };
}
