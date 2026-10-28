import type { Barber, Post, Service, Booking, Review } from '@/types';
import { getFirestoreLazy } from './firebase';
import { createSignedChatImageUrl } from './storage';

async function fs() {
  const db = await getFirestoreLazy();
  const sdk = await import('firebase/firestore');
  return { db, ...sdk };
}

export const COL = {
  barbers: 'barbers',
  posts: 'posts',
  bookings: 'bookings',
  reviews: 'reviews',
  users: 'users',
  notifications: 'notifications',
  follows: 'follows',
  referrals: 'referrals',
  checkins: 'checkins',
} as const;

export interface BarberDoc extends Omit<Barber, 'id'> {
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
  gallery?: string[];
  fcmToken?: string;
  onboardingComplete?: boolean;
  isLive?: boolean;
}

export async function createBarberProfile(uid: string, data: Partial<BarberDoc>) {
  const { db, doc, setDoc, serverTimestamp } = await fs();
  const ref = doc(db, COL.barbers, uid);
  const now = Date.now();
  const payload: BarberDoc = {
    ownerUid: uid,
    name: data.name || 'New Barber',
    shopName: data.shopName || 'My Shop',
    avatar: data.avatar || '/logo.png',
    coverImage: data.coverImage || '',
    rating: 0,
    reviewCount: 0,
    distance: '',
    eta: '',
    services: data.services || [],
    specialties: data.specialties || [],
    queueCount: 0,
    available: false,
    featured: false,
    address: data.address || '',
    description: data.description || '',
    trustScore: 80,
    avgDuration: 30,
    liveStatus: 'closed',
    followers: 0,
    gallery: [],
    createdAt: now,
    updatedAt: now,
    totalChairs: 1,
    occupiedChairs: 0,
    isOnboarded: false,
    staffIds: [],
    offersHomeService: false,
    homeServiceFee: 0,
  };
  await setDoc(ref, { ...payload, _ts: serverTimestamp() }, { merge: true });
  return { id: uid, ...payload };
}

export async function updateBarberProfile(uid: string, patch: Partial<BarberDoc>) {
  const { db, doc, setDoc } = await fs();
  await setDoc(doc(db, COL.barbers, uid), { ...patch, updatedAt: Date.now() }, { merge: true });
}

export async function getBarber(id: string): Promise<Barber | null> {
  const { db, doc, getDoc } = await fs();
  const snap = await getDoc(doc(db, COL.barbers, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Barber) : null;
}

export async function listBarbers(): Promise<Barber[]> {
  const { db, collection, getDocs, query, orderBy, limit } = await fs();
  const q = query(collection(db, COL.barbers), orderBy('rating', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Barber));
}

export function subscribeBarbers(
  cb: (barbers: Barber[]) => void,
  onError?: (error: Error) => void,
) {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      const { db, collection, onSnapshot } = await fs();
      if (cancelled) return;
      unsub = onSnapshot(collection(db, COL.barbers),
        snap => {
          const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Barber));
          const real = all
            .filter(b =>
              b.isLive !== false &&
              (b.onboardingComplete === true || b.isOnboarded === true) &&
              b.name && b.name.trim().length > 0 &&
              b.shopName && b.shopName.trim().length > 0
            )
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 100);
          cb(real);
        },
        err => onError?.(err)
      );
      if (cancelled) unsub();
    } catch (e) {
      if (!cancelled) onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  })();
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export interface PostDoc extends Omit<Post, 'id' | 'timeAgo' | 'isFollowing'> {
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
}

export async function createPost(uid: string, data: Partial<PostDoc>): Promise<string> {
  const { db, collection, addDoc } = await fs();
  const now = Date.now();
  const ref = await addDoc(collection(db, COL.posts), {
    ownerUid: uid,
    postedBy: data.postedBy || 'barber',
    barber: data.barber || { id: uid, name: '', shopName: '', avatar: '' },
    type: data.type || 'photo',
    image: data.image || '',
    beforeImage: data.beforeImage || '',
    afterImage: data.afterImage || '',
    hairStyle: data.hairStyle || '',
    tags: data.tags || [],
    likes: 0,
    comments: 0,
    saves: 0,
    location: data.location || '',
    caption: data.caption || '',
    createdAt: now,
    updatedAt: now,
  });
  void notifyFollowersOfNewPost(uid, ref.id, data.caption || 'New post', data.image || '');
  return ref.id;
}

export async function updatePost(postId: string, patch: Partial<PostDoc>) {
  const { db, doc, updateDoc } = await fs();
  await updateDoc(doc(db, COL.posts, postId), { ...patch, updatedAt: Date.now() });
}

export async function deletePost(postId: string) {
  const { db, doc, deleteDoc } = await fs();
  await deleteDoc(doc(db, COL.posts, postId));
}

export function subscribePosts(cb: (posts: Post[]) => void, ownerUid?: string) {
  let unsub: (() => void) | null = null;
  (async () => {
    try {
      const { db, collection, onSnapshot, query, orderBy, limit } = await fs();
      const base = collection(db, COL.posts);
      const q = query(base, orderBy('createdAt', 'desc'), limit(50));
      unsub = onSnapshot(q,
        snap => {
          let posts = snap.docs.map(d => {
            const data = d.data() as PostDoc;
            return {
              id: d.id,
              ...data,
              timeAgo: relativeTime(data.createdAt),
              isFollowing: false,
            } as Post;
          });
          if (ownerUid) posts = posts.filter(p => (p as any).ownerUid === ownerUid);
          cb(posts);
        },
        err => {
cb([]); }
      );
    } catch (e) {
cb([]);
    }
  })();
  return () => { if (unsub) unsub(); };
}

export interface BookingDoc {
  customerUid: string;
  customerName: string;
  customerPhone: string;
  customerAvatar?: string;
  barberId: string;
  barberName: string;
  barberShop: string;
  barberAvatar?: string;
  staffId?: string;
  staffName?: string;
  staffAvatar?: string;
  service: Service;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'requested' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
  totalPrice: number;
  tip?: number;
  homeServiceFee?: number;
  homeService?: boolean;
  payMethod?: 'cash' | 'wallet';
  pointsEarned: number;
  notes?: string;
  customerLocation?: { lat: number; lng: number };
  customerLocationUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export async function createBooking(
  data: Omit<BookingDoc, 'createdAt' | 'updatedAt' | 'status'> & { status?: BookingDoc['status'] },
  bookingId?: string,
): Promise<string> {
  const { db, collection, addDoc, doc: fsDoc, setDoc } = await fs();
  const now = Date.now();
  const docData = { ...data, status: data.status || 'requested', createdAt: now, updatedAt: now };
  let id: string;
  if (bookingId) {
    await setDoc(fsDoc(db, COL.bookings, bookingId), docData);
    id = bookingId;
  } else {
    const ref = await addDoc(collection(db, COL.bookings), docData);
    id = ref.id;
  }
  void pushNotification(data.barberId, {
    type: 'booking_request',
    title: 'طلب حجز جديد',
    body: `${data.customerName} حجز ${data.service?.name || 'خدمة'} — ${data.date} الساعة ${data.time}`,
    bookingId: id,
    fromUid: data.customerUid,
    fromName: data.customerName,
    fromAvatar: data.customerAvatar || '',
  });
  return id;
}

export async function updateCustomerLocation(bookingId: string, lat: number, lng: number) {
  const { db, doc, updateDoc } = await fs();
  await updateDoc(doc(db, COL.bookings, bookingId), {
    'customerLocation.lat': lat,
    'customerLocation.lng': lng,
    customerLocationUpdatedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export interface LiveBarberLocation {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  updatedAt: number;
}

export async function updateBarberLiveLocation(uid: string, location: Omit<LiveBarberLocation, 'updatedAt'> | null) {
  const { db, doc, updateDoc, deleteField } = await fs();
  const patch = location
    ? { liveLocation: { ...location, updatedAt: Date.now() }, liveLocationUpdatedAt: Date.now() }
    : { liveLocation: deleteField(), liveLocationUpdatedAt: deleteField() };
  await updateDoc(doc(db, COL.barbers, uid), patch);
}

export function subscribeBarberLiveLocation(uid: string, cb: (location: LiveBarberLocation | null) => void) {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      const { db, doc, onSnapshot } = await fs();
      if (cancelled) return;
      unsub = onSnapshot(doc(db, COL.barbers, uid), snap => {
        const data = snap.exists() ? snap.data().liveLocation as LiveBarberLocation | undefined : undefined;
        cb(data && Number.isFinite(data.lat) && Number.isFinite(data.lng) ? data : null);
      }, () => cb(null));
    } catch { cb(null); }
  })();
  return () => { cancelled = true; if (unsub) unsub(); };
}

export async function updateBookingStatus(bookingId: string, status: BookingDoc['status']) {
  const { db, doc, updateDoc, getDoc } = await fs();
  const ref = doc(db, COL.bookings, bookingId);
  await updateDoc(ref, { status, updatedAt: Date.now() });
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const b = snap.data() as BookingDoc;
      const titles: Record<BookingDoc['status'], string> = {
        requested: 'Booking received',
        confirmed: 'Booking accepted',
        in_progress: 'Your appointment has started',
        completed: 'Appointment complete',
        cancelled: 'Booking cancelled',
        rejected: 'Booking rejected',
      };
      // A customer cancelling their own request is already viewing the status;
      // don't create a self-notification that Firestore rules correctly reject.
      if (status !== 'cancelled') {
        await pushNotification(b.customerUid, {
          type: 'booking_update',
          title: titles[status] || 'Booking update',
          body: `${b.barberName} · ${b.service?.name || ''}`,
          bookingId,
          fromUid: b.barberId,
          fromName: b.barberName,
          fromAvatar: b.barberAvatar || '',
        });
      }
    }
  } catch { /* */ }
}

export function subscribeCustomerBookings(customerUid: string, cb: (bookings: (BookingDoc & { id: string })[]) => void) {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      if (!customerUid) { cb([]); return; }
      const { db, collection, onSnapshot, query, where } = await fs();
      if (cancelled) return;
      const q = query(collection(db, COL.bookings), where('customerUid', '==', customerUid));
      unsub = onSnapshot(q,
        snap => {
          const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as BookingDoc) }));
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          cb(items);
        },
        () => { if (!cancelled) cb([]); }
      );
    } catch {
      if (!cancelled) cb([]);
    }
  })();
  return () => { cancelled = true; if (unsub) unsub(); };
}

export function subscribeBarberBookings(barberId: string, cb: (bookings: (BookingDoc & { id: string })[]) => void) {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      if (!barberId) { cb([]); return; }
      const { db, collection, onSnapshot, query, where } = await fs();
      if (cancelled) return;
      const q = query(collection(db, COL.bookings), where('barberId', '==', barberId));
      unsub = onSnapshot(q,
        snap => {
          const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as BookingDoc) }));
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          cb(items);
        },
        () => { if (!cancelled) cb([]); }
      );
    } catch {
      if (!cancelled) cb([]);
    }
  })();
  return () => { cancelled = true; if (unsub) unsub(); };
}

export interface ReviewDoc extends Omit<Review, 'id'> {
  bookingId: string;
  barberId: string;
  customerUid: string;
  createdAt: number;
}

export async function addReview(barberId: string, customerUid: string, bookingId: string, data: Omit<ReviewDoc, 'bookingId' | 'barberId' | 'customerUid' | 'createdAt'>) {
  const { db, doc, setDoc } = await fs();
  await setDoc(doc(db, COL.reviews, bookingId), {
    ...data,
    bookingId,
    barberId,
    customerUid,
    createdAt: Date.now(),
  });
}

export function subscribeBarberReviews(barberId: string, cb: (reviews: (ReviewDoc & { id: string })[]) => void) {
  let unsub: (() => void) | null = null;
  (async () => {
    const { db, collection, onSnapshot, query, where } = await fs();
    const q = query(collection(db, COL.reviews), where('barberId', '==', barberId));
    unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as ReviewDoc) }));
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cb(items.slice(0, 30));
    });
  })();
  return () => { if (unsub) unsub(); };
}

export interface UserDoc {
  uid: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  role: 'customer' | 'barber';
  loyaltyPoints: number;
  totalBookings: number;
  createdAt: number;
  fcmToken?: string;
  referralCode?: string;         // Unique code for inviting others
  referredBy?: string;           // UID of the user who invited this person
  referralCount?: number;        // Number of people this user has referred
}

/** Generate a unique referral code from name + uid suffix */
export function generateReferralCode(name: string, uid: string): string {
  const base = (name.split(' ')[0] || 'USER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const suffix = uid.slice(-4).toUpperCase();
  return `${base}-${suffix}`;
}

export async function upsertUser(uid: string, data: Partial<UserDoc>) {
  const { db, doc, setDoc, getDoc } = await fs();
  const userRef = doc(db, COL.users, uid);
  const existing = await getDoc(userRef);
  const referralCode = data.referralCode || (existing.exists() ? existing.data().referralCode : undefined) || generateReferralCode(data.name || 'USER', uid);
  const createdAt = existing.exists()
    ? existing.data().createdAt || data.createdAt || Date.now()
    : data.createdAt || Date.now();
  await setDoc(userRef, {
    uid,
    ...data,
    referralCode,
    createdAt,
  }, { merge: true });
}

export async function getUser(uid: string): Promise<UserDoc | null> {
  const { db, doc, getDoc } = await fs();
  const snap = await getDoc(doc(db, COL.users, uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

/** Find a user doc by their referral code (used during signup) */
export async function getUserByReferralCode(code: string): Promise<UserDoc | null> {
  const { db, collection, getDocs, query, where, limit } = await fs();
  const q = query(collection(db, COL.users), where('referralCode', '==', code.toUpperCase()), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as UserDoc;
}

/**
 * Process referral on new user signup.
 * Awards 100 points to inviter, 50 points welcome to new user.
 */
export async function processReferralSignup(referralCode: string) {
  const { getFunctionsLazy } = await import('./firebase');
  const functions = await getFunctionsLazy();
  const { httpsCallable } = await import('firebase/functions');
  const callable = httpsCallable<{ referralCode: string }, { status: 'awarded' | 'already_processed' | 'invalid' }>(functions, 'processReferralSignup');
  const result = await callable({ referralCode: referralCode.trim().toUpperCase() });
  return result.data.status;
}

export interface CheckinDoc {
  customerUid: string;
  customerName: string;
  barberId: string;
  barberName: string;
  lat?: number;
  lng?: number;
  pointsAwarded: number;
  createdAt: number;
}

/**
 * Record a QR scan check-in for a barbershop.
 * Uses a deterministic doc ID (customerUid_barberId_YYYY-MM-DD) to:
 *  - enforce once-per-day limit without composite index
 *  - make the write idempotent
 */
export async function recordCheckin(
  customerUid: string,
  _customerName: string,
  barberId: string,
  coords: { lat: number; lng: number; accuracy: number },
): Promise<{ success: boolean; message: string; points: number; barberName: string }> {
  try {
    if (!customerUid || !barberId || !coords) {
      return { success: false, message: 'Sign in and allow location access to check in.', points: 0, barberName: '' };
    }
    const { getFunctionsLazy } = await import('./firebase');
    const { httpsCallable } = await import('firebase/functions');
    const functions = await getFunctionsLazy();
    const checkin = httpsCallable<
      { barberId: string; lat: number; lng: number; accuracy: number },
      { status: 'recorded' | 'already_checked_in'; points: number; barberName: string }
    >(functions, 'recordCheckin');
    const result = (await checkin({ barberId, lat: coords.lat, lng: coords.lng, accuracy: coords.accuracy })).data;
    if (result.status === 'already_checked_in') {
      return { success: false, message: 'Already checked in today', points: 0, barberName: result.barberName };
    }
    return { success: true, message: 'Checked in successfully', points: result.points, barberName: result.barberName };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Check-in failed';
    return { success: false, message, points: 0, barberName: '' };
  }
}

export function subscribeCustomerCheckins(
  customerUid: string,
  cb: (checkins: (CheckinDoc & { id: string })[]) => void,
) {
  let unsub: (() => void) | null = null;
  (async () => {
    try {
      if (!customerUid) { cb([]); return; }
      const { db, collection, onSnapshot, query, where, orderBy, limit } = await fs();
      const q = query(
        collection(db, COL.checkins),
        where('customerUid', '==', customerUid),
        orderBy('createdAt', 'desc'),
        limit(20),
      );
      unsub = onSnapshot(q,
        snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as CheckinDoc) }))),
        err => {
cb([]); }
      );
    } catch (e) {
cb([]); }
  })();
  return () => { if (unsub) unsub(); };
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  return `${w}w`;
}

export interface FollowDoc {
  followerUid: string;
  barberId: string;
  barberName?: string;
  barberAvatar?: string;
  createdAt: number;
}

export async function followBarber(followerUid: string, barber: { id: string; name?: string; avatar?: string }) {
  const { db, doc, setDoc } = await fs();
  const id = `${followerUid}__${barber.id}`;
  await setDoc(doc(db, COL.follows, id), {
    followerUid,
    barberId: barber.id,
    barberName: barber.name || '',
    barberAvatar: barber.avatar || '',
    createdAt: Date.now(),
  });
}

export async function unfollowBarber(followerUid: string, barberId: string) {
  const { db, doc, deleteDoc } = await fs();
  const id = `${followerUid}__${barberId}`;
  await deleteDoc(doc(db, COL.follows, id));
}

export async function isFollowing(followerUid: string, barberId: string): Promise<boolean> {
  const { db, doc, getDoc } = await fs();
  const snap = await getDoc(doc(db, COL.follows, `${followerUid}__${barberId}`));
  return snap.exists();
}

export function subscribeFollowing(followerUid: string, cb: (followedBarberIds: string[]) => void) {
  let unsub: (() => void) | null = null;
  (async () => {
    try {
      if (!followerUid) { cb([]); return; }
      const { db, collection, onSnapshot, query, where } = await fs();
      const q = query(collection(db, COL.follows), where('followerUid', '==', followerUid));
      unsub = onSnapshot(q,
        snap => cb(snap.docs.map(d => (d.data() as FollowDoc).barberId)),
        err => {
cb([]); }
      );
    } catch (e) {
cb([]); }
  })();
  return () => { if (unsub) unsub(); };
}

async function getFollowerUids(barberId: string): Promise<string[]> {
  const { db, collection, getDocs, query, where } = await fs();
  const q = query(collection(db, COL.follows), where('barberId', '==', barberId));
  const snap = await getDocs(q);
  return snap.docs.map(d => (d.data() as FollowDoc).followerUid);
}

export interface NotificationDoc {
  toUid: string;
  type: 'booking_request' | 'booking_update' | 'new_post' | 'follow' | 'message' | 'promo';
  title: string;
  body: string;
  fromUid?: string;
  fromName?: string;
  fromAvatar?: string;
  bookingId?: string;
  postId?: string;
  read: boolean;
  createdAt: number;
}

export async function pushNotification(
  toUid: string,
  data: Omit<NotificationDoc, 'toUid' | 'read' | 'createdAt'>
) {
  if (!toUid) return false;
  try {
    const { db, collection, addDoc } = await fs();
    await addDoc(collection(db, COL.notifications), {
      toUid,
      ...data,
      read: false,
      createdAt: Date.now(),
    });
    return true;
  } catch {
    return false;
  }
}

export function subscribeNotifications(
  toUid: string,
  cb: (items: (NotificationDoc & { id: string })[]) => void
) {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      if (!toUid) { cb([]); return; }
      const { db, collection, onSnapshot, query, where } = await fs();
      if (cancelled) return;
      const q = query(collection(db, COL.notifications), where('toUid', '==', toUid));
      unsub = onSnapshot(q,
        snap => {
          const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as NotificationDoc) }));
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          cb(items.slice(0, 50));
        },
        () => { if (!cancelled) cb([]); }
      );
    } catch {
      if (!cancelled) cb([]);
    }
  })();
  return () => { cancelled = true; if (unsub) unsub(); };
}

export async function markNotificationRead(id: string) {
  try {
    const { db, doc, updateDoc } = await fs();
    await updateDoc(doc(db, COL.notifications, id), { read: true });
  } catch { /* */ }
}

export async function markAllNotificationsRead(toUid: string) {
  try {
    const { db, collection, getDocs, query, where, writeBatch } = await fs();
    const q = query(collection(db, COL.notifications), where('toUid', '==', toUid), where('read', '==', false));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  } catch { /* */ }
}

async function notifyFollowersOfNewPost(barberUid: string, postId: string, caption: string, image: string) {
  try {
    const followers = await getFollowerUids(barberUid);
    if (!followers.length) return;
    const barber = await getBarber(barberUid);
    const fromName = barber?.name || 'Your barber';
    const fromAvatar = barber?.avatar || '';
    await Promise.all(followers.map(uid => pushNotification(uid, {
      type: 'new_post',
      title: `ًں“¸ ${fromName} posted a new look`,
      body: caption.slice(0, 80) || 'Tap to view',
      fromUid: barberUid,
      fromName,
      fromAvatar,
      postId,
    })));
  } catch { /* */ }
}

export async function completeBarberOnboarding(uid: string) {
  const { db, doc, setDoc } = await fs();
  await setDoc(doc(db, COL.barbers, uid), {
    onboardingComplete: true,
    isLive: true,
    updatedAt: Date.now(),
  }, { merge: true });
}

export async function isBarberOnboardingComplete(uid: string): Promise<boolean> {
  const { db, doc, getDoc } = await fs();
  const snap = await getDoc(doc(db, COL.barbers, uid));
  return snap.exists() && (snap.data() as BarberDoc).onboardingComplete === true;
}

export interface StaffDoc {
  barberId: string;
  salonOwnerId: string;
  name: string;
  specialties: string[];
  avatar?: string;
  workingHours?: { open: string; close: string };
  bookingsCount: number;
  completedCount: number;
  createdAt: number;
}

export async function addStaffMember(salonOwnerId: string, data: Omit<StaffDoc, 'salonOwnerId' | 'bookingsCount' | 'completedCount' | 'createdAt'>) {
  const { db, collection, addDoc } = await fs();
  const ref = await addDoc(collection(db, 'staff'), {
    ...data,
    salonOwnerId,
    bookingsCount: 0,
    completedCount: 0,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function updateStaffMember(staffId: string, patch: Partial<StaffDoc>) {
  const { db, doc, updateDoc } = await fs();
  await updateDoc(doc(db, 'staff', staffId), patch);
}

export async function deleteStaffMember(staffId: string) {
  const { db, doc, deleteDoc } = await fs();
  await deleteDoc(doc(db, 'staff', staffId));
}

export function subscribeStaff(salonOwnerId: string, cb: (staff: (StaffDoc & { id: string })[]) => void) {
  let unsub: (() => void) | null = null;
  (async () => {
    try {
      if (!salonOwnerId) { cb([]); return; }
      const { db, collection, onSnapshot, query, where } = await fs();
      const q = query(collection(db, 'staff'), where('salonOwnerId', '==', salonOwnerId));
      unsub = onSnapshot(q,
        snap => {
          const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as StaffDoc) }));
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          cb(items);
        },
        err => {
cb([]); }
      );
    } catch (e) {
cb([]);
    }
  })();
  return () => { if (unsub) unsub(); };
}

export interface PayoutDoc {
  barberId: string;
  amount: number;
  status: 'pending' | 'paid';
  method: string;
  note?: string;
  createdAt: number;
  paidAt?: number;
}

export async function createPayout(barberId: string, data: Omit<PayoutDoc, 'barberId' | 'createdAt'>) {
  const { db, collection, addDoc } = await fs();
  const ref = await addDoc(collection(db, 'payouts'), {
    ...data,
    barberId,
    createdAt: Date.now(),
  });
  return ref.id;
}

export function subscribePayouts(barberId: string, cb: (payouts: (PayoutDoc & { id: string })[]) => void) {
  let unsub: (() => void) | null = null;
  (async () => {
    try {
      if (!barberId) { cb([]); return; }
      const { db, collection, onSnapshot, query, where, orderBy, limit } = await fs();
      const q = query(
        collection(db, 'payouts'),
        where('barberId', '==', barberId),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      unsub = onSnapshot(q,
        snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as PayoutDoc) }))),
        err => {
cb([]); }
      );
    } catch (e) {
cb([]); }
  })();
  return () => { if (unsub) unsub(); };
}

export interface MessageDoc {
  bookingId: string;
  fromUid: string;
  fromName: string;
  fromAvatar?: string;
  toUid: string;
  text: string;
  imageUrl?: string;
  createdAt: number;
  read: boolean;
}

export async function sendBookingMessage(
  bookingId: string,
  from: { uid: string; name: string; avatar?: string },
  toUid: string,
  toName: string,
  text: string,
  imageUrl?: string,
): Promise<void> {
  const { db, collection, addDoc } = await fs();
  const payload: MessageDoc = {
    bookingId,
    fromUid: from.uid,
    fromName: from.name,
    fromAvatar: from.avatar || '',
    toUid,
    text,
    createdAt: Date.now(),
    read: false,
  };
  if (imageUrl) payload.imageUrl = imageUrl;
  await addDoc(collection(db, `messages/${bookingId}/msgs`), payload);
  void pushNotification(toUid, {
    type: 'message',
    title: `ًں’¬ ${from.name}`,
    body: imageUrl ? (text || 'ًں“· طµظˆط±ط©') : text.slice(0, 100),
    fromUid: from.uid,
    fromName: from.name,
    fromAvatar: from.avatar || '',
    bookingId,
  });
}

export function subscribeBookingMessages(
  bookingId: string,
  cb: (messages: (MessageDoc & { id: string })[]) => void
) {
  let unsub: (() => void) | null = null;
  let active = true;
  let revision = 0;
  (async () => {
    try {
      if (!bookingId) { cb([]); return; }
      const { db, collection, onSnapshot, query, orderBy } = await fs();
      const q = query(collection(db, `messages/${bookingId}/msgs`), orderBy('createdAt', 'asc'));
      unsub = onSnapshot(q,
        snap => {
          const currentRevision = ++revision;
          const messages = snap.docs.map(d => ({ id: d.id, ...(d.data() as MessageDoc) }));
          void Promise.all(messages.map(async message => {
            if (!message.imageUrl?.startsWith('supabase-storage://')) return message;
            try {
              return { ...message, imageUrl: await createSignedChatImageUrl(message.imageUrl) };
            } catch {
              return { ...message, imageUrl: undefined };
            }
          })).then(resolved => {
            if (active && currentRevision === revision) cb(resolved);
          });
        },
        () => { if (active) cb([]); }
      );
    } catch (e) {
      if (active) cb([]);
    }
  })();
  return () => { active = false; revision += 1; if (unsub) unsub(); };
}

export interface GalleryImageDoc {
  barberId: string;
  imageUrl: string;
  thumbnail?: string;
  description?: string;
  createdAt: number;
}

export async function addGalleryImage(barberId: string, imageUrl: string, description?: string) {
  const { db, collection, addDoc } = await fs();
  const ref = await addDoc(collection(db, 'gallery'), {
    barberId,
    imageUrl,
    description,
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function deleteGalleryImage(imageId: string) {
  const { db, doc, deleteDoc } = await fs();
  await deleteDoc(doc(db, 'gallery', imageId));
}

export function subscribeGallery(barberId: string, cb: (images: (GalleryImageDoc & { id: string })[]) => void) {
  let unsub: (() => void) | null = null;
  (async () => {
    try {
      if (!barberId) { cb([]); return; }
      const { db, collection, onSnapshot, query, where, orderBy, limit } = await fs();
      const q = query(
        collection(db, 'gallery'),
        where('barberId', '==', barberId),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      unsub = onSnapshot(q,
        snap => cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as GalleryImageDoc) }))),
        err => {
cb([]); }
      );
    } catch (e) {
cb([]);
    }
  })();
  return () => { if (unsub) unsub(); };
}

