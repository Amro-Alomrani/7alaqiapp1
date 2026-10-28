import { createGoogleAdmin } from '../_shared/google-admin.mjs';
import { createMediaStorage } from '../../../functions/media-storage.mjs';
import { createBackendHandler } from './handler.ts';

const admin = createGoogleAdmin({ projectId: 'halaqyapp', getCredentials: () => Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '' });
const media = createMediaStorage({
  projectUrl: Deno.env.get('SUPABASE_URL') || 'https://vjeuesqrzywragnjvkpi.supabase.co',
  getSecret: () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  getBooking: async (id: string) => (await admin.get(`bookings/${id}`))?.data || null,
});
Deno.serve(createBackendHandler({
  admin, media,
  getJobToken: () => Deno.env.get('BACKEND_JOB_TOKEN') || '',
  firebaseProjectId: 'halaqyapp',
  firebaseApiKey: Deno.env.get('FIREBASE_WEB_API_KEY') || 'AIzaSyCBRzHkkASsgW-o8WuCca6LsSjtXkNAYiE',
  schedule: task => EdgeRuntime.waitUntil(task),
  signedUploadCutoff: Number(Deno.env.get('SIGNED_UPLOADS_DISABLED_AT') || 0),
}));
