import {
  signInWithGoogleFirebase,
  startPhoneSignIn,
  confirmPhoneSignIn,
  signOutFirebase,
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
} from './firebase';

export interface AuthUser {
  uid: string;
  name?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  provider: 'phone' | 'google' | 'apple' | 'local';
}

export async function sendPhoneOTP(phoneE164: string): Promise<{ verificationId: string }> {
  const verificationId = await startPhoneSignIn(phoneE164);
  return { verificationId };
}

export async function verifyPhoneOTP(
  verificationId: string,
  code: string,
  phone: string,
): Promise<AuthUser> {
  if (!verificationId) throw new Error('Missing verification id');
  if (!/^\d{6}$/.test(code)) throw new Error('Code must be 6 digits');

  const user = await confirmPhoneSignIn(code);
  return {
    uid: user.uid,
    phone: user.phoneNumber || phone,
    name: user.displayName || undefined,
    avatar: user.photoURL || undefined,
    provider: 'phone',
  };
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const user = await signInWithGoogleFirebase();
  return {
    uid: user.uid,
    name: user.displayName || 'Google User',
    email: user.email || undefined,
    phone: user.phoneNumber || undefined,
    avatar: user.photoURL || undefined,
    provider: 'google',
  };
}

export async function signInWithApple(): Promise<AuthUser> {
  throw new Error('Apple sign-in not configured for this build');
}

export async function signOutAll() {
  try { await signOutFirebase(); } catch {  }
}

/**
 * Create a new account record. Persists to Firestore immediately so the
 * user shows up in real-time data on every device.
 */
export async function createAccount(data: {
  name: string;
  phone: string;
  email?: string;
  role: 'customer' | 'barber';
  shopName?: string;
}): Promise<AuthUser> {
  const { upsertUser, createBarberProfile } = await import('./db');
  const uid = `phone_${data.phone.replace(/\D/g, '')}`;
  const avatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(data.phone)}`;
  try {
    await upsertUser(uid, {
      name: data.name,
      phone: data.phone,
      email: data.email,
      avatar,
      role: data.role,
      loyaltyPoints: 0,
      totalBookings: 0,
    });
    if (data.role === 'barber') {
      await createBarberProfile(uid, {
        name: data.name,
        shopName: data.shopName || `${data.name}'s Shop`,
        avatar,
      });
    }
  } catch { /* */ }
  return {
    uid,
    name: data.name,
    phone: data.phone,
    email: data.email,
    avatar,
    provider: 'local',
  };
}

export function isFirebaseConfigured() { return true; }

export async function registerEmail(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'customer' | 'barber';
  shopName?: string;
  lat?: number;
  lng?: number;
  address?: string;
}): Promise<AuthUser> {
  const user = await signUpWithEmail(data.email, data.password, data.name);
  const avatar = user.photoURL || `https://i.pravatar.cc/150?u=${encodeURIComponent(data.email)}`;
  const { upsertUser, createBarberProfile, updateBarberProfile } = await import('./db');
  try {
    await upsertUser(user.uid, {
      name: data.name,
      phone: data.phone || '',
      email: data.email,
      avatar,
      role: data.role,
      loyaltyPoints: 0,
      totalBookings: 0,
    });
    if (data.role === 'barber') {
      await createBarberProfile(user.uid, {
        name: data.name,
        shopName: data.shopName || `${data.name}'s Shop`,
        avatar,
        address: data.address || '',
      });
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        await updateBarberProfile(user.uid, { lat: data.lat, lng: data.lng });
      }
    }
  } catch { /* */ }
  return {
    uid: user.uid,
    name: data.name,
    email: data.email,
    phone: data.phone,
    avatar,
    provider: 'local',
  };
}

export async function loginEmail(email: string, password: string): Promise<AuthUser> {
  const user = await signInWithEmail(email, password);
  return {
    uid: user.uid,
    name: user.displayName || email.split('@')[0],
    email: user.email || email,
    phone: user.phoneNumber || undefined,
    avatar: user.photoURL || `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
    provider: 'local',
  };
}

export async function resetPassword(email: string) {
  await sendPasswordReset(email);
}
