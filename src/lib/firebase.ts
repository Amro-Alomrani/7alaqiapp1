/**
 * Barber Go — Firebase (fully lazy loading)
 *
 * Nothing from Firebase runs on initial module import. The SDK is only
 * pulled in when an auth function is actually called. This guarantees
 * the app renders even if Firebase is misconfigured.
 */

import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Messaging } from 'firebase/messaging';
import type { Firestore } from 'firebase/firestore';

const localQa = import.meta.env.MODE === 'qa';
function assertLocalQa() {
  if (localQa && !['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname)) {
    throw new Error('The QA build can only run on localhost.');
  }
}

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCBRzHkkASsgW-o8WuCca6LsSjtXkNAYiE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'halaqyapp.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://halaqyapp-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'halaqyapp',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'halaqyapp.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '559982533825',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:559982533825:android:09d88e5eec3bd11d200840',
};

let appPromise: Promise<FirebaseApp> | null = null;
let authPromise: Promise<Auth> | null = null;
let firestorePromise: Promise<Firestore> | null = null;

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
      const { getAuth, connectAuthEmulator } = await import('firebase/auth');
      const auth = getAuth(app);
      if (localQa) { assertLocalQa(); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); }
      return auth;
    })();
  }
  return authPromise;
}

export async function getFirebaseAuthLazy() {
  return getAuthInstance();
}

export async function signInWithGoogleFirebase() {
  const auth = await getAuthInstance();
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
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

export async function onAuthChange(cb: (user: User | null) => void) {
  const auth = await getAuthInstance();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, cb);
}

export async function getFirestoreLazy() {
  if (!firestorePromise) firestorePromise = (async () => {
    const app = await getApp();
    const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
    const db = getFirestore(app);
    if (localQa) { assertLocalQa(); connectFirestoreEmulator(db, '127.0.0.1', 8089); }
    return db;
  })();
  return firestorePromise;
}

export async function getFunctionsLazy() {
  if (localQa) throw new Error('Cloud-only actions require testing against the live backend separately.');
  const app = await getApp();
  const { getFunctions } = await import('firebase/functions');
  return getFunctions(app, 'us-central1');
}

export async function getRealtimeDbLazy() {
  const app = await getApp();
  const { getDatabase } = await import('firebase/database');
  return getDatabase(app);
}

let messagingPromise: Promise<Messaging | null> | null = null;
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
    // Capacitor's registration token is an APNs token on iOS. Convert it to an
    // FCM token before saving it because the Cloud Function sends through FCM.
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const permission = await PushNotifications.checkPermissions();
      const granted = permission.receive === 'granted'
        ? permission
        : await PushNotifications.requestPermissions();
      if (granted.receive !== 'granted') return null;

      const registration = new Promise<string>((resolve, reject) => {
        let settled = false;
        let registrationHandle: { remove: () => Promise<void> } | undefined;
        let errorHandle: { remove: () => Promise<void> } | undefined;
        const finish = (error?: Error, token?: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          void registrationHandle?.remove();
          void errorHandle?.remove();
          if (error) reject(error);
          else if (token) resolve(token);
          else reject(new Error('Push registration returned no token'));
        };
        const timeout = setTimeout(() => finish(new Error('Push registration timed out')), 15000);
        void (async () => {
          registrationHandle = await PushNotifications.addListener('registration', async event => {
            try {
              if (Capacitor.getPlatform() === 'ios') {
                const { FCM } = await import('@capacitor-community/fcm');
                const result = await FCM.getToken();
                finish(undefined, result.token);
              } else {
                finish(undefined, event.value);
              }
            } catch (error) {
              finish(error instanceof Error ? error : new Error('Unable to get FCM token'));
            }
          });
          if (settled) { void registrationHandle.remove(); return; }
          errorHandle = await PushNotifications.addListener('registrationError', error => {
            finish(new Error(error.error || 'Push registration failed'));
          });
          if (settled) { void errorHandle.remove(); return; }
          await PushNotifications.register();
        })().catch(error => finish(error instanceof Error ? error : new Error('Push registration failed')));
      });
      return await registration;
    }

    // Web FCM needs a VAPID key and a Firebase messaging service worker. Those
    // are intentionally not fabricated from the native Android Firebase config.
    return null;
  } catch {
return null;
  }
}
