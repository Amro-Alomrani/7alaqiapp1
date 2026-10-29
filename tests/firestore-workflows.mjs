import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, collection, query, where, onSnapshot, writeBatch, runTransaction, deleteDoc, terminate, setLogLevel } from 'firebase/firestore';
import { encodeFields } from '../supabase/functions/_shared/google-admin.mjs';
import { definedFields } from '../src/lib/definedFields.ts';

const project = `demo-workflows-${Date.now()}`;
const endpoint = `http://127.0.0.1:8089/v1/projects/${project}/databases/(default)/documents`;
const apps = []; setLogLevel('silent');
const client = uid => {
  const app = initializeApp({ projectId: project }, 'workflows-' + uid); apps.push(app);
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8089, { mockUserToken: { sub: uid, user_id: uid } }); return db;
};
async function seed(path, data) {
  const response = await fetch(`${endpoint}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: encodeFields(data) }) });
  assert.equal(response.ok, true);
}
const customer = client('workflow-customer'), barber = client('workflow-barber'), outsider = client('workflow-outsider');
const service = { id: 'cut', name: 'Haircut', duration: 30, price: 5, icon: 'scissors' };
const bookingId = 'workflow-booking';
const notification = (type, fromUid, toUid) => ({ type, fromUid, toUid, bookingId, title: 'Workflow test', body: 'Workflow test', read: false, createdAt: Date.now(), pushPending: true, nextAttemptAt: 0, pushAttempts: 0 });
let followerCount; let stop;
const waitFor = async (condition, label) => {
  const deadline = Date.now() + 8000;
  while (!condition()) { if (Date.now() > deadline) throw Error(label); await new Promise(resolve => setTimeout(resolve, 20)); }
};
try {
  await seed('barbers/workflow-barber', { ownerUid: 'workflow-barber', isLive: true, services: [service] });
  const batch = writeBatch(customer);
  batch.set(doc(customer, 'bookings', bookingId), definedFields({ customerUid: 'workflow-customer', barberId: 'workflow-barber', service, staffId: undefined, staffName: undefined, staffAvatar: undefined, status: 'requested', totalPrice: 5, tip: 0, pointsEarned: 0, payMethod: 'cash', createdAt: 1, updatedAt: 1 }));
  batch.set(doc(customer, 'notifications', 'workflow-request'), notification('booking_request', 'workflow-customer', 'workflow-barber'));
  await batch.commit();
  assert.equal((await getDoc(doc(barber, 'notifications', 'workflow-request'))).exists(), true);
  assert.equal('staffId' in (await getDoc(doc(customer, 'bookings', bookingId))).data(), false);
  console.log('PASS booking and barber notification commit together.');

  stop = onSnapshot(query(collection(customer, 'follows'), where('barberId', '==', 'workflow-barber')), snapshot => { followerCount = snapshot.size; });
  await waitFor(() => followerCount === 0, 'Initial follow count');
  const followRef = doc(customer, 'follows', 'workflow-customer__workflow-barber');
  const follow = () => runTransaction(customer, async transaction => {
    if ((await transaction.get(followRef)).exists()) return;
    transaction.set(followRef, { followerUid: 'workflow-customer', barberId: 'workflow-barber', createdAt: 1 });
  });
  await follow(); await waitFor(() => followerCount === 1, 'Follow count must increase');
  await follow(); assert.equal(followerCount, 1);
  await deleteDoc(followRef); await waitFor(() => followerCount === 0, 'Unfollow count must decrease');
  console.log('PASS follow/unfollow counts update live; duplicate follows count once.');

  await runTransaction(barber, async transaction => {
    const ref = doc(barber, 'bookings', bookingId); await transaction.get(ref);
    transaction.update(ref, { status: 'confirmed', updatedAt: 2 });
    transaction.set(doc(barber, 'notifications', 'workflow-confirmed'), notification('booking_update', 'workflow-barber', 'workflow-customer'));
  });
  assert.equal((await getDoc(doc(customer, 'bookings', bookingId))).data().status, 'confirmed');
  console.log('PASS barber acceptance and customer notification commit together.');

  const chat = writeBatch(customer);
  chat.set(doc(customer, 'messages', bookingId, 'msgs', 'm1'), { bookingId, fromUid: 'workflow-customer', toUid: 'workflow-barber', text: 'Test', read: false, createdAt: 3 });
  chat.set(doc(customer, 'notifications', 'workflow-chat'), notification('message', 'workflow-customer', 'workflow-barber'));
  await chat.commit();
  await assert.rejects(getDoc(doc(outsider, 'messages', bookingId, 'msgs', 'm1')), { code: 'permission-denied' });
  const bad = writeBatch(customer);
  bad.update(doc(customer, 'bookings', bookingId), { status: 'completed', updatedAt: 4 });
  bad.set(doc(customer, 'notifications', 'workflow-invalid'), notification('booking_update', 'workflow-customer', 'workflow-barber'));
  await assert.rejects(bad.commit(), { code: 'permission-denied' });
  assert.equal((await getDoc(doc(barber, 'bookings', bookingId))).data().status, 'confirmed');
  console.log('PASS chat is private; invalid status changes roll back the entire batch.');

  await setDoc(doc(barber, 'bookings', bookingId), { status: 'in_progress', updatedAt: 5 }, { merge: true });
  await setDoc(doc(barber, 'bookings', bookingId), { status: 'completed', updatedAt: 6 }, { merge: true });
  await setDoc(doc(customer, 'reviews', bookingId), { bookingId, barberId: 'workflow-barber', customerUid: 'workflow-customer', customerName: 'Workflow customer', customerAvatar: '', rating: 4, comment: '', createdAt: 7 });
  assert.equal((await getDoc(doc(barber, 'reviews', bookingId))).data().rating, 4);
  await assert.rejects(setDoc(doc(outsider, 'reviews', 'invalid'), { bookingId: 'invalid', barberId: 'workflow-barber', customerUid: 'workflow-outsider', rating: 5, createdAt: 8 }), { code: 'permission-denied' });
  console.log('PASS reviews persist only for the real booking customer after completion.');
} finally {
  stop?.();
  for (const app of apps) { await terminate(getFirestore(app)); await deleteApp(app); }
}
