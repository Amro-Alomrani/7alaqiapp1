import { MediaStorageError } from '../../../functions/media-storage.mjs';

export async function verifyFirebaseUser(request: Request, options: {
  firebaseProjectId: string; firebaseApiKey: string; fetchImpl?: typeof fetch;
}) {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token || token.length > 20_000) throw new MediaStorageError('unauthenticated', 'Sign in to continue.');
  let claims;
  try {
    const bytes = Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
    claims = JSON.parse(new TextDecoder().decode(bytes));
  } catch { throw new MediaStorageError('unauthenticated', 'Sign in again to continue.'); }
  if (claims.aud !== options.firebaseProjectId || claims.iss !== `https://securetoken.google.com/${options.firebaseProjectId}`
    || typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128
    || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) {
    throw new MediaStorageError('unauthenticated', 'Sign in again to continue.');
  }
  const response = await (options.fetchImpl || fetch)(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${options.firebaseApiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) throw new MediaStorageError('unavailable', 'Sign-in verification is temporarily unavailable.');
    throw new MediaStorageError('unauthenticated', 'Sign in again to continue.');
  }
  const user = (await response.json()).users?.[0];
  if (!user || user.disabled || user.localId !== claims.sub || Number(claims.auth_time || claims.iat || 0) < Number(user.validSince || 0)) {
    throw new MediaStorageError('unauthenticated', 'Sign in again to continue.');
  }
  return { uid: user.localId as string, token, claims, createdAt: Number(user.createdAt || 0), email: user.email as string | undefined };
}
