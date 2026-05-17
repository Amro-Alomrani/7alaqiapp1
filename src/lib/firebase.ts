/**
 * Barber Go — Firebase (fully lazy loading)
 *
 * Nothing from Firebase runs on initial module import. The SDK is only
 * pulled in when an auth function is actually called. This guarantees
 * the app renders even if Firebase is misconfigured.
 */

export const firebaseConfig = {
  apiKey: 'AIzaSyCBRzHkkASsgW-o8WuCca6LsSjtXkNAYiE',
  authDomain: 'halaqyapp.firebaseapp.com',
  databaseURL: 'https://halaqyapp-default-rtdb.firebaseio.com',
  projectId: 'halaqyapp',
  storageBucket: 'halaqyapp.firebasestorage.app',
  messagingSenderId: '559982533825',
  appId: '1:559982533825:android:09d88e5eec3bd11d200840',
};

let appPromise: Promise<any> | null = null;
let authPromise: Promise<any> | null = null;
let recaptcha: any = null;
let pendingConfirmation: any = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      return getApps().length ? getApp() : initializeApp(firebaseConfig);
    })();
  }
  return appPromise;
}

async function getAuthInstance() {
  if (!authPromise) {
    authPromise = (async () => {
      const app = await getApp();
      const { getAuth } = await import('firebase/auth');
      return getAuth(app);
    })();
  }
  return authPromise;
}

function ensureRecaptchaContainer(): HTMLElement {
  let el = document.getElementById('recaptcha-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'recaptcha-container';
    el.style.position = 'fixed';
    el.style.bottom = '0';
    el.style.right = '0';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
  }
  return el;
}

export async function signInWithGoogleFirebase() {
  const auth = await getAuthInstance();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function startPhoneSignIn(phoneE164: string) {
  const auth = await getAuthInstance();
  const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
  ensureRecaptchaContainer();
  if (!recaptcha) {
    recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  }
  pendingConfirmation = await signInWithPhoneNumber(auth, phoneE164, recaptcha);
  return pendingConfirmation.verificationId as string;
}

export async function confirmPhoneSignIn(code: string) {
  if (!pendingConfirmation) throw new Error('No pending phone confirmation. Send the code first.');
  const cred = await pendingConfirmation.confirm(code);
  pendingConfirmation = null;
  return cred.user;
}

export async function signOutFirebase() {
  try {
    const auth = await getAuthInstance();
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
  } catch {
    
  }
}

export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const auth = await getAuthInstance();
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && cred.user) {
    try { await updateProfile(cred.user, { displayName }); } catch {  }
  }
  return cred.user;
}

export async function signInWithEmail(email: string, password: string) {
  const auth = await getAuthInstance();
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function sendPasswordReset(email: string) {
  const auth = await getAuthInstance();
  const { sendPasswordResetEmail } = await import('firebase/auth');
  await sendPasswordResetEmail(auth, email);
}

export async function onAuthChange(cb: (user: any) => void) {
  const auth = await getAuthInstance();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, cb);
}

export async function getFirestoreLazy() {
  const app = await getApp();
  const { getFirestore } = await import('firebase/firestore');
  return getFirestore(app);
}

export async function getRealtimeDbLazy() {
  const app = await getApp();
  const { getDatabase } = await import('firebase/database');
  return getDatabase(app);
}

let messagingPromise: Promise<any> | null = null;
export async function getMessagingLazy() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const app = await getApp();
      const { getMessaging, isSupported } = await import('firebase/messaging');
      if (await isSupported()) {
        return getMessaging(app);
      }
      return null;
    })();
  }
  return messagingPromise;
}

export async function requestFcmToken() {
  try {
    const messaging = await getMessagingLazy();
    if (!messaging) return null;
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging);
    return token as string;
  } catch (e) {
return null;
  }
}

export function isFirebaseReady() { return true; }
