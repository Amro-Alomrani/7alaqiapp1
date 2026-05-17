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
  const s = await storage();
  const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
  const r = ref(s, path);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(r, file);
    task.on('state_changed',
      snap => {
        if (onProgress) onProgress((snap.bytesTransferred / snap.totalBytes) * 100);
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (e) { reject(e); }
      },
    );
  });
}

export async function deleteImage(path: string): Promise<void> {
  const s = await storage();
  const { ref, deleteObject } = await import('firebase/storage');
  try { await deleteObject(ref(s, path)); } catch {  }
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
