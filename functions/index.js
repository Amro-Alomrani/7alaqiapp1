const { initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { getMessaging } = require('firebase-admin/messaging');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');

initializeApp();
const db = getFirestore();

exports.deliverNotificationPush = onDocumentCreated({
  document: 'notifications/{notificationId}',
  region: 'us-central1',
}, async event => {
  const notification = event.data?.data();
  if (!notification?.toUid || typeof notification.title !== 'string' || typeof notification.body !== 'string') return;

  const userRef = db.collection('users').doc(notification.toUid);
  const barberRef = db.collection('barbers').doc(notification.toUid);
  const [user, barber] = await Promise.all([userRef.get(), barberRef.get()]);
  const recipientRef = barber.exists && barber.get('fcmToken') ? barberRef : userRef;
  const recipient = recipientRef === barberRef ? barber : user;
  const token = recipient.get('fcmToken');
  if (typeof token !== 'string' || !token.trim()) return;

  const data = { notificationId: event.params.notificationId, type: String(notification.type || '') };
  for (const key of ['bookingId', 'postId']) {
    if (typeof notification[key] === 'string' && notification[key]) data[key] = notification[key];
  }

  try {
    await getMessaging().send({
      token,
      notification: { title: notification.title, body: notification.body },
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (error) {
    const code = error?.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      await recipientRef.update({ fcmToken: FieldValue.delete() }).catch(() => {});
      return;
    }
    console.error('Notification delivery failed', { notificationId: event.params.notificationId, code });
    throw error;
  }
});

exports.deleteOwnAccount = onCall({ region: 'us-central1', timeoutSeconds: 540, memory: '1GiB' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before deleting your account.');
  const authTime = Number(request.auth.token.auth_time || 0);
  if (!authTime || Date.now() / 1000 - authTime > 10 * 60) {
    throw new HttpsError('failed-precondition', 'Sign in again before deleting your account.');
  }

  const uid = request.auth.uid;
  const queries = [
    ['bookings', 'customerUid'], ['bookings', 'barberId'],
    ['posts', 'ownerUid'], ['reviews', 'customerUid'], ['reviews', 'barberId'],
    ['notifications', 'toUid'], ['notifications', 'fromUid'],
    ['staff', 'salonOwnerId'], ['staff', 'barberId'],
    ['payouts', 'customerUid'], ['payouts', 'barberId'],
    ['checkins', 'customerUid'], ['referrals', 'inviterUid'], ['referrals', 'newUserUid'],
    ['follows', 'followerUid'], ['follows', 'barberId'],
    ['gallery', 'barberId'], ['gallery', 'ownerUid'],
  ];
  const snapshots = await Promise.all(queries.map(([collection, field]) =>
    db.collection(collection).where(field, '==', uid).get()
  ));
  const refs = new Map();
  snapshots.forEach(snapshot => snapshot.docs.forEach(doc => refs.set(doc.ref.path, doc.ref)));
  const bookingDocs = snapshots
    .filter((_, index) => queries[index][0] === 'bookings')
    .flatMap(snapshot => snapshot.docs);
  const bookingIds = [...new Set(bookingDocs.map(doc => doc.id))];
  bookingIds.forEach(bookingId => {
    // Chat messages live beside, not beneath, each booking document.
    refs.set(`messages/${bookingId}`, db.collection('messages').doc(bookingId));
  });
  const postDocs = snapshots
    .filter((_, index) => queries[index][0] === 'posts')
    .flatMap(snapshot => snapshot.docs);
  refs.set(`users/${uid}`, db.collection('users').doc(uid));
  refs.set(`barbers/${uid}`, db.collection('barbers').doc(uid));

  const deletions = [...refs.values()];
  for (let i = 0; i < deletions.length; i += 20) {
    await Promise.all(deletions.slice(i, i + 20).map(ref => db.recursiveDelete(ref)));
  }

  const invitees = await db.collection('users').where('referredBy', '==', uid).get();
  if (!invitees.empty) {
    const batch = db.batch();
    invitees.docs.forEach(doc => batch.update(doc.ref, { referredBy: FieldValue.delete() }));
    await batch.commit();
  }

  const bucket = getStorage().bucket();
  await Promise.all([
    bucket.deleteFiles({ prefix: `users/${uid}/` }),
    bucket.deleteFiles({ prefix: `barbers/${uid}/` }),
    bucket.deleteFiles({ prefix: `posts/${uid}/` }),
    ...bookingIds.map(bookingId => bucket.deleteFiles({ prefix: `chats/${bookingId}/` })),
    ...postDocs.map(post => bucket.deleteFiles({ prefix: `posts/${uid}/${post.id}/` })),
  ]);
  await getAuth().deleteUser(uid);
  return { status: 'deleted' };
});

exports.recordCheckin = onCall({ region: 'us-central1' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to check in.');
  const uid = request.auth.uid;
  const barberId = typeof request.data?.barberId === 'string' ? request.data.barberId.trim() : '';
  const lat = Number(request.data?.lat);
  const lng = Number(request.data?.lng);
  const accuracy = Number(request.data?.accuracy);
  if (!barberId || barberId.length > 128 || !Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180
    || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 150) {
    throw new HttpsError('invalid-argument', 'A valid salon QR and current device location are required.');
  }

  const barberRef = db.collection('barbers').doc(barberId);
  const userRef = db.collection('users').doc(uid);
  const checkinDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const checkinRef = db.collection('checkins').doc(`${uid}_${barberId}_${checkinDay}`);

  const outcome = await db.runTransaction(async transaction => {
    const [barberSnap, userSnap, priorCheckin] = await Promise.all([
      transaction.get(barberRef), transaction.get(userRef), transaction.get(checkinRef),
    ]);
    if (!barberSnap.exists || !userSnap.exists || barberSnap.get('isLive') !== true) {
      throw new HttpsError('failed-precondition', 'This salon is not available for check-in.');
    }
    if (priorCheckin.exists) return { status: 'already_checked_in', points: 0, barberName: barberSnap.get('shopName') || barberSnap.get('name') || '' };

    const salonLat = Number(barberSnap.get('lat'));
    const salonLng = Number(barberSnap.get('lng'));
    if (!Number.isFinite(salonLat) || !Number.isFinite(salonLng)
      || salonLat < -90 || salonLat > 90 || salonLng < -180 || salonLng > 180) {
      throw new HttpsError('failed-precondition', 'The salon has not saved a verified map location.');
    }
    const radians = value => value * Math.PI / 180;
    const dLat = radians(lat - salonLat);
    const dLng = radians(lng - salonLng);
    const a = Math.min(1, Math.sin(dLat / 2) ** 2
      + Math.cos(radians(salonLat)) * Math.cos(radians(lat)) * Math.sin(dLng / 2) ** 2);
    const distanceMeters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distanceMeters > 250) {
      throw new HttpsError('failed-precondition', 'You must be near the salon to check in.');
    }

    const points = 20;
    const userName = userSnap.get('name') || request.auth.token.name || '';
    const barberName = barberSnap.get('shopName') || barberSnap.get('name') || '';
    transaction.create(checkinRef, {
      customerUid: uid, customerName: userName, barberId,
      barberName, pointsAwarded: points, createdAt: Date.now(),
    });
    transaction.update(userRef, { loyaltyPoints: FieldValue.increment(points) });
    return { status: 'recorded', points, barberName };
  });

  if (outcome.status === 'recorded') {
    await db.collection('notifications').add({
      toUid: barberId, type: 'promo', title: 'New salon check-in',
      body: `${request.auth.token.name || 'A customer'} checked in at your salon.`,
      fromUid: uid, fromName: request.auth.token.name || '', read: false, createdAt: Date.now(),
    }).catch(() => {});
  }
  return outcome;
});

exports.recomputeReviewStats = onDocumentWritten({ document: 'reviews/{reviewId}', region: 'us-central1' }, async event => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const barberIds = [...new Set([before?.barberId, after?.barberId].filter(Boolean))];
  await Promise.all(barberIds.map(async barberId => {
    const reviews = await db.collection('reviews').where('barberId', '==', barberId).get();
    const ratings = reviews.docs.map(doc => Number(doc.get('rating'))).filter(value => Number.isFinite(value) && value >= 1 && value <= 5);
    const rating = ratings.length ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10 : 0;
    await db.collection('barbers').doc(barberId).set({ rating, reviewCount: ratings.length }, { merge: true });
  }));
});

exports.recomputeFollowerCount = onDocumentWritten({ document: 'follows/{followId}', region: 'us-central1' }, async event => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const barberIds = [...new Set([before?.barberId, after?.barberId].filter(Boolean))];
  await Promise.all(barberIds.map(async barberId => {
    const count = await db.collection('follows').where('barberId', '==', barberId).count().get();
    await db.collection('barbers').doc(barberId).set({ followers: count.data().count }, { merge: true });
  }));
});

exports.applyBookingCompletion = onDocumentWritten({ document: 'bookings/{bookingId}', region: 'us-central1' }, async event => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  if (!before || !after || before.status === after.status) return;
  const bookingRef = event.data.after.ref;
  if (after.status === 'completed') {
    await db.runTransaction(async transaction => {
      const [booking, user] = await Promise.all([
        transaction.get(bookingRef), transaction.get(db.collection('users').doc(after.customerUid)),
      ]);
      if (!booking.exists || booking.get('status') !== 'completed' || booking.get('loyaltyRewardGranted') === true || !user.exists) return;
      transaction.update(bookingRef, { loyaltyRewardGranted: true, pointsEarned: 30 });
      transaction.update(user.ref, { loyaltyPoints: FieldValue.increment(30), totalBookings: FieldValue.increment(1) });
    });
  }
  if (after.barberId) {
    const count = await db.collection('bookings')
      .where('barberId', '==', after.barberId)
      .where('status', '==', 'in_progress')
      .count().get();
    await db.collection('barbers').doc(after.barberId).set({ occupiedChairs: count.data().count }, { merge: true });
  }
});

exports.processReferralSignup = onCall({ region: 'us-central1' }, async request => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before applying an invite code.');
  }

  const newUserUid = request.auth.uid;
  const code = typeof request.data?.referralCode === 'string'
    ? request.data.referralCode.trim().toUpperCase()
    : '';
  if (!code || code.length > 32) return { status: 'invalid' };

  const inviterQuery = await db.collection('users')
    .where('referralCode', '==', code)
    .limit(1)
    .get();
  if (inviterQuery.empty || inviterQuery.docs[0].id === newUserUid) {
    return { status: 'invalid' };
  }

  const inviterRef = inviterQuery.docs[0].ref;
  const inviteeRef = db.collection('users').doc(newUserUid);
  const referralRef = db.collection('referrals').doc(newUserUid);

  return db.runTransaction(async transaction => {
    const [inviter, invitee, priorReferral] = await Promise.all([
      transaction.get(inviterRef),
      transaction.get(inviteeRef),
      transaction.get(referralRef),
    ]);
    if (!inviter.exists || !invitee.exists) {
      throw new HttpsError('failed-precondition', 'User profile is not ready for referral processing.');
    }
    if (priorReferral.exists) return { status: 'already_processed' };
    if (invitee.get('referredBy')) return { status: 'already_processed' };

    transaction.update(inviterRef, {
      loyaltyPoints: FieldValue.increment(100),
      referralCount: FieldValue.increment(1),
    });
    transaction.update(inviteeRef, {
      loyaltyPoints: FieldValue.increment(50),
      referredBy: inviterRef.id,
    });
    transaction.create(referralRef, {
      inviterUid: inviterRef.id,
      inviterName: inviter.get('name') || '',
      newUserUid,
      newUserName: invitee.get('name') || '',
      pointsAwarded: 100,
      createdAt: Date.now(),
    });
    return { status: 'awarded' };
  });
});
