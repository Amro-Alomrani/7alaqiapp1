import { writeFile, mkdir } from 'node:fs/promises';
import { encodeFields } from '../supabase/functions/_shared/google-admin.mjs';

const project = 'demo-halaqi-qa';
const password = 'Local-QA-only-2026!';
async function account(email) {
  const request = async action => {
    const response = await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${action}?key=local-emulator-only`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }), signal: AbortSignal.timeout(5000) });
    return { response, body: await response.json() };
  };
  let result = await request('signUp');
  if (result.body.error?.message === 'EMAIL_EXISTS') result = await request('signInWithPassword');
  if (!result.response.ok) throw Error('Local QA sign-in failed.');
  return { uid: result.body.localId, email, password };
}
async function seed(path, data) {
  const response = await fetch(`http://127.0.0.1:8089/v1/projects/${project}/databases/(default)/documents/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: encodeFields(data) }), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error(`Local QA document failed: ${path.split('/')[0]}`);
}
const customer = await account('customer@7alaqi-qa.example.invalid');
const barber = await account('barber@7alaqi-qa.example.invalid');
for (const [role, user] of [['customer', customer], ['barber', barber]]) {
  await seed(`users/${user.uid}`, { uid: user.uid, role, name: role === 'customer' ? 'حساب زبون تجريبي' : 'حساب حلاق تجريبي', email: user.email, phone: '', avatar: '/logo.png', createdAt: Date.now(), loyaltyPoints: 0, totalBookings: 0 });
}
await seed(`barbers/${barber.uid}`, {
  ownerUid: barber.uid, name: 'حساب حلاق تجريبي', shopName: 'حلاقي — بيئة الاختبار',
  avatar: '/logo.png', coverImage: '', description: 'بيانات اختبار محلية؛ لا تظهر للمستخدمين الفعليين.',
  address: 'موقع اختبار', lat: 31.9539, lng: 35.9106,
  isLive: true, onboardingComplete: true, isOnboarded: true, liveStatus: 'available', available: true,
  services: [{ id: 'qa-haircut', name: 'قص الشعر', price: 5, duration: 30, icon: '✂️' }, { id: 'qa-package', name: 'باقة شعر ولحية', price: 8, duration: 45, icon: '💈' }],
  offersHomeService: true, homeServiceFee: 3, rating: 0, reviewCount: 0, followers: 0, trustScore: 0,
  totalChairs: 1, occupiedChairs: 0, queueCount: 0, avgDuration: 30, specialties: ['قص الشعر', 'تشذيب اللحية'],
  gallery: [], staffIds: [], createdAt: Date.now(), updatedAt: Date.now(),
  workingHours: { open: '00:00', close: '23:59', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
});
await mkdir('.firebase', { recursive: true });
await writeFile('.firebase/local-qa-accounts.json', JSON.stringify({ project, customer, barber }, null, 2));
console.log('Local-only QA accounts and salon ready. No live project data was written.');
