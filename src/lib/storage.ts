import { ensureSupabaseBookingMediaAccess } from './firebase';
import {
  getSupabase,
  PRIVATE_STORAGE_MARKER,
  SUPABASE_PRIVATE_CHAT_BUCKET,
  SUPABASE_PUBLIC_MEDIA_BUCKET,
} from './supabase';

function storageBucketForPath(path: string) {
  return path.startsWith('chats/') ? SUPABASE_PRIVATE_CHAT_BUCKET : SUPABASE_PUBLIC_MEDIA_BUCKET;
}

function normalizeStoragePath(path: string) {
  const normalized = path.replace(/^\/+/, '');
  const parts = normalized.split('/');
  if (!normalized || parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid image path.');
  }
  return normalized;
}

export async function uploadImage(
  file: File | Blob,
  path: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (file.size === 0) throw new Error('Selected image is empty.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Selected image is over the 10 MB limit.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Selected file is not an image.');
  const objectPath = normalizeStoragePath(path);
  const isChatImage = objectPath.startsWith('chats/');
  if (isChatImage) {
    const bookingId = objectPath.split('/')[1];
    if (!bookingId) throw new Error('A booking is required for a private chat image.');
    await ensureSupabaseBookingMediaAccess(bookingId);
  }

  if (onProgress) onProgress(0);
  const bucketId = storageBucketForPath(objectPath);
  const { data, error } = await getSupabase().storage.from(bucketId).upload(objectPath, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
  if (onProgress) onProgress(100);

  if (isChatImage) return `${PRIVATE_STORAGE_MARKER}${bucketId}/${data.path}`;
  return getSupabase().storage.from(bucketId).getPublicUrl(data.path).data.publicUrl;
}

export function describeImageUploadError(error: unknown, arabic = false): string {
  const err = error as { code?: string; message?: string; statusCode?: string; name?: string };
  const code = err?.code || '';
  if (code === 'storage/unauthorized' || err?.statusCode === '403') return 'Storage denied the upload. Check the bucket policies and your signed-in account.';
  if (code === 'storage/bucket-not-found' || code === 'storage/no-default-bucket' || err?.statusCode === '404') return 'The configured image storage bucket was not found.';
  if (code === 'storage/quota-exceeded' || /quota.*exceed/i.test(err?.message || '')) {
    return arabic
      ? 'تعذر رفع الصورة بسبب حد التخزين. تحقق من الحصة المتاحة في مشروع التخزين.'
      : 'The image could not be uploaded because the storage quota was reached. Check the storage project quota.';
  }
  if (code === 'storage/unauthenticated' || err?.statusCode === '401') return 'Your sign-in expired. Sign in again and retry the upload.';
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled' || err?.name === 'AbortError') return 'Upload timed out or was interrupted. Check your connection and retry.';
  return err?.message || 'Image upload failed. Check the storage configuration and policies.';
}

export async function deleteImage(path: string): Promise<void> {
  try {
    const markerlessPath = path.startsWith(PRIVATE_STORAGE_MARKER)
      ? path.slice(PRIVATE_STORAGE_MARKER.length)
      : path;
    const slash = markerlessPath.indexOf('/');
    const bucketId = slash > 0 ? markerlessPath.slice(0, slash) : storageBucketForPath(markerlessPath);
    const objectPath = normalizeStoragePath(slash > 0 ? markerlessPath.slice(slash + 1) : markerlessPath);
    const { error } = await getSupabase().storage.from(bucketId).remove([objectPath]);
    if (error) throw error;
  } catch {
    // Image cleanup is best-effort; the owning record may already be removed.
  }
}

export async function createSignedChatImageUrl(marker: string): Promise<string> {
  if (!marker.startsWith(PRIVATE_STORAGE_MARKER)) return marker;
  const rest = marker.slice(PRIVATE_STORAGE_MARKER.length);
  const slash = rest.indexOf('/');
  if (slash < 1) throw new Error('Invalid private chat image reference.');
  const bucketId = rest.slice(0, slash);
  const objectPath = normalizeStoragePath(rest.slice(slash + 1));
  const { data, error } = await getSupabase().storage.from(bucketId).createSignedUrl(objectPath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export function pickImage(accept = 'image/*'): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export function postImagePath(uid: string, postId: string, name = 'main') {
  const ext = 'jpg';
  return `posts/${uid}/${postId}/${name}-${Date.now()}.${ext}`;
}

/** Generate a storage path for a barber profile image. */
export function profileImagePath(uid: string, kind: 'avatar' | 'cover' | 'gallery') {
  return `barbers/${uid}/${kind}-${Date.now()}.jpg`;
}

/** Simpler upload for common cases: auto-path based on type. */
export async function uploadProfileImage(
  uid: string,
  file: File,
  kind: 'avatar' | 'cover' | 'gallery',
  onProgress?: (pct: number) => void,
): Promise<string> {
  const path = profileImagePath(uid, kind);
  return uploadImage(file, path, onProgress);
}

export async function uploadPostImage(
  uid: string,
  file: File,
  postId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const path = postImagePath(uid, postId, 'main');
  return uploadImage(file, path, onProgress);
}
