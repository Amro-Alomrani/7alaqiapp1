import { createMediaHandler } from './handler.ts';
import { createUploadHandler } from './upload.ts';
import { createGoogleAdmin } from '../_shared/google-admin.mjs';

function serverKey(): string {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey) return serviceKey;
  try { return JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || ''; }
  catch { return ''; }
}

const options = {
  projectUrl: Deno.env.get('SUPABASE_URL') || 'https://vjeuesqrzywragnjvkpi.supabase.co',
  getSecret: serverKey,
  firebaseProjectId: 'halaqyapp',
  firebaseApiKey: Deno.env.get('FIREBASE_WEB_API_KEY') || 'AIzaSyCBRzHkkASsgW-o8WuCca6LsSjtXkNAYiE',
};
const jsonHandler = createMediaHandler(options);
const uploadHandler = createUploadHandler({ ...options, admin: createGoogleAdmin({ projectId: 'halaqyapp', getCredentials: () => Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON') || '' }) });
Deno.serve(request => new URL(request.url).searchParams.get('upload') === '1' ? uploadHandler(request) : jsonHandler(request));
