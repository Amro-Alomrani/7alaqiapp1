import {
  deleteMediaObject,
  getPrivateMediaUrl,
  uploadMediaImage,
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
  if (onProgress) onProgress(0);
  const uploaded = await uploadMediaImage(objectPath, file, onProgress);
  if (uploaded.bucket !== storageBucketForPath(objectPath)) throw new Error('Invalid image bucket.');
  return uploaded.url;
}

export function describeImageUploadError(error: unknown, arabic = false): string {
  const err = error as { code?: string; message?: string; statusCode?: string; name?: string };
  const code = err?.code || '';
  if (code === 'storage/unauthorized' || err?.statusCode === '403') return arabic ? 'تعذر السماح برفع الصورة. تأكد من حسابك وحاول مجددًا.' : 'This account is not allowed to upload the image.';
  if (code === 'storage/bucket-not-found' || code === 'storage/no-default-bucket' || err?.statusCode === '404') return arabic ? 'خدمة الصور غير متاحة حاليًا. حاول لاحقًا.' : 'Image storage is currently unavailable. Try again later.';
  if (code === 'storage/quota-exceeded' || /quota.*exceed/i.test(err?.message || '')) {
    return arabic
      ? 'تعذر رفع الصورة بسبب حد التخزين. تحقق من الحصة المتاحة في مشروع التخزين.'
      : 'The image could not be uploaded because the storage quota was reached. Check the storage project quota.';
  }
  if (code === 'storage/unauthenticated' || err?.statusCode === '401') return arabic ? 'انتهت جلسة الدخول. سجّل الدخول وحاول رفع الصورة مجددًا.' : 'Your sign-in expired. Sign in again and retry the upload.';
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled' || err?.name === 'AbortError') return arabic ? 'انقطع رفع الصورة. تحقق من الاتصال وحاول مجددًا.' : 'Upload timed out or was interrupted. Check your connection and retry.';
  return arabic ? 'تعذر رفع الصورة. تحقق من الاتصال وحاول مجددًا.' : 'Image upload failed. Check your connection and retry.';
}

export async function deleteImage(path: string): Promise<void> {
  let bucketId = storageBucketForPath(path);
  let objectPath = path;
  if (path.startsWith(PRIVATE_STORAGE_MARKER)) {
    const rest = path.slice(PRIVATE_STORAGE_MARKER.length);
    const slash = rest.indexOf('/');
    bucketId = rest.slice(0, slash);
    objectPath = rest.slice(slash + 1);
  } else if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    const configuredOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
    if (url.origin !== configuredOrigin || !url.pathname.startsWith('/storage/v1/object/public/')) {
      throw new Error('Invalid image URL.');
    }
    const parts = url.pathname.slice('/storage/v1/object/public/'.length).split('/').map(decodeURIComponent);
    bucketId = parts.shift() || '';
    objectPath = parts.join('/');
  }
  if (![SUPABASE_PUBLIC_MEDIA_BUCKET, SUPABASE_PRIVATE_CHAT_BUCKET].includes(bucketId)) throw new Error('Invalid image bucket.');
  await deleteMediaObject(bucketId, normalizeStoragePath(objectPath));
}

export async function createSignedChatImageUrl(marker: string): Promise<string> {
  if (!marker.startsWith(PRIVATE_STORAGE_MARKER)) return marker;
  const rest = marker.slice(PRIVATE_STORAGE_MARKER.length);
  const slash = rest.indexOf('/');
  if (slash < 1) throw new Error('Invalid private chat image reference.');
  const bucketId = rest.slice(0, slash);
  const objectPath = normalizeStoragePath(rest.slice(slash + 1));
  if (bucketId !== SUPABASE_PRIVATE_CHAT_BUCKET || !objectPath.startsWith('chats/')) throw new Error('Invalid private image bucket.');
  return (await getPrivateMediaUrl(bucketId, objectPath)).url;
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
