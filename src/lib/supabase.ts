import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAccessToken } from './firebase';

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
    accessToken: getSupabaseAccessToken,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchWithTimeout },
  });
  return client;
}

export const SUPABASE_PUBLIC_MEDIA_BUCKET =
  (import.meta.env.VITE_SUPABASE_PUBLIC_MEDIA_BUCKET as string | undefined) || 'halaqi-media';

export const SUPABASE_PRIVATE_CHAT_BUCKET =
  (import.meta.env.VITE_SUPABASE_PRIVATE_CHAT_BUCKET as string | undefined) || 'halaqi-chat';

export const PRIVATE_STORAGE_MARKER = 'supabase-storage://';
