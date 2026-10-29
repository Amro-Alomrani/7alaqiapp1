import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getFirebaseAuthLazy } from './firebase';
import { transferImage } from './mediaTransport';

const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

let client: SupabaseClient | null = null;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort();
  if (upstreamSignal?.aborted) controller.abort();
  else upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });

  const timer = window.setTimeout(() => controller.abort(), 45_000);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    window.clearTimeout(timer);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  });
}

export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!projectUrl || !publishableKey) {
    throw new Error('Supabase Storage is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  client = createClient(projectUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchWithTimeout },
  });
  return client;
}

async function mediaOperation<T>(action: 'download' | 'delete', details: Record<string, unknown>): Promise<T> {
  getSupabase();
  const auth = await getFirebaseAuthLazy();
  if (!auth.currentUser) throw Object.assign(new Error('Sign in to access images.'), { code: 'storage/unauthenticated' });
  const token = await auth.currentUser.getIdToken();
  const response = await fetchWithTimeout(`${projectUrl}/functions/v1/media`, {
    method: 'POST',
    headers: { apikey: publishableKey!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...details }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error?.message || 'The image request failed.'), {
      code: payload?.error?.code || 'storage/request-failed', statusCode: String(response.status),
    });
  }
  return payload as T;
}

export async function uploadMediaImage(path: string, image: Blob, onProgress?: (pct: number) => void): Promise<{ bucket: string; path: string; url: string }> {
  getSupabase();
  const auth = await getFirebaseAuthLazy();
  if (!auth.currentUser) throw Object.assign(new Error('Sign in to upload images.'), { code: 'storage/unauthenticated' });
  const token = await auth.currentUser.getIdToken();
  onProgress?.(0);
  const result = await transferImage(`${projectUrl}/functions/v1/media?upload=1&path=${encodeURIComponent(path)}`, {
    apikey: publishableKey!, Authorization: `Bearer ${token}`, 'Content-Type': image.type || 'image/jpeg',
  }, image);
  onProgress?.(100);
  return result;
}

export function getPrivateMediaUrl(bucket: string, path: string) {
  return mediaOperation<{ url: string; expiresIn: number }>('download', { bucket, path });
}

export function deleteMediaObject(bucket: string, path: string) {
  return mediaOperation<{ status: 'deleted' }>('delete', { bucket, path });
}

export async function backendRequest<T>(action: string, details: Record<string, unknown> = {}, requireUser = true): Promise<T> {
  getSupabase();
  let token: string | undefined;
  if (requireUser) {
    const auth = await getFirebaseAuthLazy();
    if (!auth.currentUser) throw Object.assign(new Error('Sign in to continue.'), { code: 'unauthenticated' });
    token = await auth.currentUser.getIdToken();
  }
  const response = await fetchWithTimeout(`${projectUrl}/functions/v1/backend`, {
    method: 'POST', headers: { apikey: publishableKey!, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...details }),
  });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message || 'The request failed.'), { code: payload?.error?.code || 'unavailable' });
  return payload as T;
}

export const SUPABASE_PUBLIC_MEDIA_BUCKET =
  (import.meta.env.VITE_SUPABASE_PUBLIC_MEDIA_BUCKET as string | undefined) || 'halaqi-media';

export const SUPABASE_PRIVATE_CHAT_BUCKET =
  (import.meta.env.VITE_SUPABASE_PRIVATE_CHAT_BUCKET as string | undefined) || 'halaqi-chat';

export const PRIVATE_STORAGE_MARKER = 'supabase-storage://';
