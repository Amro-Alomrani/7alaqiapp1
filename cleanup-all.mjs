/**
 * Run with: node cleanup-all.mjs
 *
 * Deletes:
 *  1. All barbers where onboardingComplete !== true  (fake / incomplete)
 *  2. Barbers with clearly fake/test names (keyboard mash, "qweqwe", etc.)
 *  3. All posts (fresh start)
 *  4. All bookings (fresh start)
 *
 * Press Ctrl+C within the 5-second countdown to abort.
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCBRzHkkASsgW-o8WuCca6LsSjtXkNAYiE',
  authDomain: 'halaqyapp.firebaseapp.com',
  projectId: 'halaqyapp',
  storageBucket: 'halaqyapp.firebasestorage.app',
  messagingSenderId: '559982533825',
  appId: '1:559982533825:android:09d88e5eec3bd11d200840',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/** Returns true if the name looks like a fake/test account */
function isFakeName(name = '', shopName = '') {
  const combined = `${name} ${shopName}`.toLowerCase().trim();
  if (!combined || combined === ' ') return true;

  // Keyboard mash: same character repeated, or very short random strings
  const fakePhrases = [
    'qweqwe', 'qwe', 'test', 'fake', 'asdf', 'zxcv',
    'هضصثضصث', 'هضصث', 'ضصث', 'صث', 'اا', 'بب',
    '123', 'aaa', 'abc', 'xxx', 'yyy', 'zzz',
    'new barber', 'my shop',  // default placeholder names from db.ts
  ];

  for (const phrase of fakePhrases) {
    if (combined.includes(phrase)) return true;
  }

  // If name is only 1-2 chars it's probably fake
  if (name.trim().length <= 2 && shopName.trim().length <= 2) return true;

  return false;
}

async function deleteCollection(colName, predicate = () => true, label = colName) {
  const snap = await getDocs(collection(db, colName));
  const toDelete = snap.docs.filter(d => predicate(d));
  console.log(`  [${label}] Total docs: ${snap.size}  →  deleting: ${toDelete.length}`);

  for (const d of toDelete) {
    const data = d.data();
    if (colName === 'barbers') {
      const n = data.name || '?';
      const s = data.shopName || '?';
      process.stdout.write(`    🗑  "${n}" / "${s}"\n`);
    }
    await deleteDoc(doc(db, colName, d.id));
  }
  return toDelete.length;
}

async function run() {
  console.log('\n🔍  Reading Firestore collections…\n');

  const barberSnap  = await getDocs(collection(db, 'barbers'));
  const postSnap    = await getDocs(collection(db, 'posts'));
  const bookingSnap = await getDocs(collection(db, 'bookings'));

  const fakeBarbers = barberSnap.docs.filter(d => {
    const { onboardingComplete, name, shopName } = d.data();
    return onboardingComplete !== true || isFakeName(name, shopName);
  });

  console.log(`📊  Barbers total       : ${barberSnap.size}`);
  console.log(`   ├─ Real (to keep)   : ${barberSnap.size - fakeBarbers.length}`);
  console.log(`   └─ Fake (to delete) : ${fakeBarbers.length}`);
  console.log(`📊  Posts (all delete) : ${postSnap.size}`);
  console.log(`📊  Bookings (all del) : ${bookingSnap.size}`);

  if (barberSnap.size > 0) {
    console.log('\nAll barbers in DB:');
    barberSnap.docs.forEach(d => {
      const { name, shopName, onboardingComplete } = d.data();
      const tag = isFakeName(name, shopName) ? '🗑  FAKE' : (onboardingComplete !== true ? '🗑  INCOMPLETE' : '✅  KEEP');
      console.log(`  ${tag}  [${d.id.slice(0,8)}…]  "${name || '?'}" / "${shopName || '?'}"`);
    });
  }

  if (fakeBarbers.length === 0 && postSnap.size === 0 && bookingSnap.size === 0) {
    console.log('\n✅  Database is already clean — nothing to delete.');
    process.exit(0);
  }

  console.log('\n⚠️   Deleting in 5 seconds — press Ctrl+C to abort.\n');
  await new Promise(r => setTimeout(r, 5000));

  console.log('🗑️   Deleting fake/incomplete barbers…');
  const b = await deleteCollection('barbers',
    d => {
      const { onboardingComplete, name, shopName } = d.data();
      return onboardingComplete !== true || isFakeName(name, shopName);
    },
    'barbers'
  );

  console.log('🗑️   Deleting ALL posts…');
  const p = await deleteCollection('posts', () => true, 'posts');

  console.log('🗑️   Deleting ALL bookings…');
  const bk = await deleteCollection('bookings', () => true, 'bookings');

  console.log(`\n✅  Done!`);
  console.log(`   Barbers deleted  : ${b}`);
  console.log(`   Posts deleted    : ${p}`);
  console.log(`   Bookings deleted : ${bk}`);
  process.exit(0);
}

run().catch(e => {
  console.error('❌  Error:', e.message);
  process.exit(1);
});
