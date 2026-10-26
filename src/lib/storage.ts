import { getFirestoreLazy } from './firebase';

async function storage() {
  await getFirestoreLazy();
  const { getStorage } = await import('firebase/storage');
  const { getApp } = await import('firebase/app');
  return getStorage(getApp());
}

export async function uploadImage(
  file: File | Blob,
  path: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (file.size === 0) throw new Error('Selected image is empty.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Selected image is over the 10 MB limit.');
  if (file.type && !file.type.startsWith('image/')) throw new Error('Selected file is not an image.');
  const s = await storage();
  const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
  const r = ref(s, path);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(r, file);
    const timer = setTimeout(() => {
      task.cancel();
      reject(Object.assign(new Error('Image upload timed out. Check your connection and retry.'), { code: 'storage/retry-limit-exceeded' }));
    }, 45_000);
    task.on('state_changed',
      snap => {
        if (onProgress) onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
      },
      error => { clearTimeout(timer); reject(error); },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          clearTimeout(timer);
          resolve(url);
        } catch (e) { clearTimeout(timer); reject(e); }
      },
    );
  });
}

export function describeImageUploadError(error: unknown, arabic = false): string {
  const err = error as { code?: string; message?: string };
  const code = err?.code || '';
  if (code === 'storage/unauthorized') return 'Firebase Storage denied the upload. Check Storage rules and the signed-in Firebase project.';
  if (code === 'storage/bucket-not-found' || code === 'storage/no-default-bucket') return 'Firebase Storage bucket is missing or does not match this app configuration.';
  if (code === 'storage/quota-exceeded' || /quota.*exceed/i.test(err?.message || '')) {
    return arabic
      ? 'وصل مشروع Firebase إلى حد التخزين المسموح. على مالك المشروع مراجعة استخدام التخزين والفوترة قبل عودة رفع الصور.'
      : 'Firebase Storage has reached its project quota. The Firebase project owner must review Storage usage and billing before uploads can resume.';
  }
  if (code === 'storage/unauthenticated') return 'Your sign-in expired. Sign in again and retry the upload.';
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled') return 'Upload was interrupted. Check your connection and retry.';
  return err?.message || 'Image upload failed. Check Firebase Storage configuration and rules.';
}

export async function deleteImage(path: string): Promise<void> {
  const s = await storage();
  const { ref, deleteObject } = await import('firebase/storage');
  try { await deleteObject(ref(s, path)); } catch { /* Best-effort cleanup; callers can continue without blocking. */ }
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
