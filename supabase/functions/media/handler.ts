import { createMediaStorage, MediaStorageError } from '../../../functions/media-storage.mjs';
import { verifyFirebaseUser } from '../_shared/firebase-user.ts';

type Options = {
  projectUrl: string;
  getSecret: () => string;
  firebaseProjectId: string;
  firebaseApiKey: string;
  fetchImpl?: typeof fetch;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

export function createMediaHandler(options: Options) {
  const requestFetch = options.fetchImpl || fetch;
  const json = (data: unknown, status = 200) => Response.json(data, { status, headers: cors });

  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: { code: 'invalid-argument', message: 'POST is required.' } }, 405);
    try {
      const user = await verifyFirebaseUser(request, options);
      const token = user.token;

      const bodyText = await request.text();
      if (bodyText.length > 16_384) throw new MediaStorageError('invalid-argument', 'Image request is too large.');
      let body;
      try { body = JSON.parse(bodyText); } catch { throw new MediaStorageError('invalid-argument', 'A valid image request is required.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new MediaStorageError('invalid-argument', 'A valid image request is required.');

      const media = createMediaStorage({
        projectUrl: options.projectUrl,
        getSecret: options.getSecret,
        fetchImpl: requestFetch,
        getBooking: async (bookingId: string) => {
          const response = await requestFetch(`https://firestore.googleapis.com/v1/projects/${options.firebaseProjectId}/databases/(default)/documents/bookings/${encodeURIComponent(bookingId)}`, {
            headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000),
          });
          if ([403, 404].includes(response.status)) return null;
          if (!response.ok) throw new MediaStorageError('unavailable', 'Booking verification is temporarily unavailable.');
          const fields = (await response.json()).fields;
          return { customerUid: fields?.customerUid?.stringValue, barberId: fields?.barberId?.stringValue };
        },
      });
      if (body.action === 'upload') throw new MediaStorageError('invalid-argument', 'Use the authenticated image upload endpoint.');
      if (body.action === 'download') return json(await media.createDownload(user.uid, body));
      if (body.action === 'delete') return json(await media.remove(user.uid, body));
      throw new MediaStorageError('invalid-argument', 'Unknown image operation.');
    } catch (error) {
      if (error instanceof MediaStorageError) {
        const statuses: Record<string, number> = { unauthenticated: 401, 'permission-denied': 403, 'invalid-argument': 400, unavailable: 503, 'failed-precondition': 503 };
        return json({ error: { code: error.code, message: error.message } }, statuses[error.code] || 500);
      }
      // Never log credentials, Firebase tokens, signed URLs, or request bodies.
      return json({ error: { code: 'unavailable', message: 'The image operation could not be completed. Retry shortly.' } }, 503);
    }
  };
}
