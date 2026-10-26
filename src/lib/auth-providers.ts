import {
  signInWithGoogleFirebase,
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
  provider: 'email' | 'google' | 'apple';
}

export async function signInWithGoogle(): Promise<AuthUser> {
  const user = await signInWithGoogleFirebase();
  return {
    uid: user.uid,
    name: user.displayName || user.email || 'User',
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
  const avatar = user.photoURL || '/logo.png';
  const { upsertUser, createBarberProfile, updateBarberProfile } = await import('./db');
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
  return {
    uid: user.uid,
    name: data.name,
    email: data.email,
    phone: data.phone,
    avatar,
    provider: 'email',
  };
}

export async function loginEmail(email: string, password: string): Promise<AuthUser> {
  const user = await signInWithEmail(email, password);
  return {
    uid: user.uid,
    name: user.displayName || email.split('@')[0],
    email: user.email || email,
    phone: user.phoneNumber || undefined,
    avatar: user.photoURL || '/logo.png',
    provider: 'email',
  };
}

export async function resetPassword(email: string) {
  await sendPasswordReset(email);
}
