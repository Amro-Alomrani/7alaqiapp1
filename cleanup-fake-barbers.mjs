/**
 * Run with: node cleanup-fake-barbers.mjs
 * Deletes all barber documents in Firestore that do NOT have onboardingComplete === true
 * Uses the Firebase client SDK (no service account needed — uses the same project config)
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCBRzHkkASsgW-o8WuCca6LsSjtXkNAYiE',
  authDomain: 'halaqyapp.firebaseapp.com',
  projectId: 'halaqyapp',
  storageBucket: 'halaqyapp.firebasestorage.app',
  messagingSenderId: '559982533825',
  appId: '1:559982533825:android:09d88e5eec3bd11d200840',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanFakeBarbers() {
  console.log('🔍 Fetching all barber documents...');
  const snap = await getDocs(collection(db, 'barbers'));

  const toDelete = snap.docs.filter(d => {
    const data = d.data();
    return data.onboardingComplete !== true;
  });

  console.log(`📊 Total barbers: ${snap.size}`);
  console.log(`🗑️  Fake/incomplete accounts to delete: ${toDelete.length}`);
  console.log(`✅ Real accounts to keep: ${snap.size - toDelete.length}`);

  if (toDelete.length === 0) {
    console.log('\n✅ Nothing to delete — all barbers are already real!');
    process.exit(0);
  }

  console.log('\nAccounts that will be DELETED:');
  toDelete.forEach(d => {
    const data = d.data();
    console.log(`  - [${d.id}] ${data.name || '?'} / ${data.shopName || '?'} (onboardingComplete: ${data.onboardingComplete})`);
  });

  console.log('\n⚠️  Starting deletion in 3 seconds... Press Ctrl+C to abort.');
  await new Promise(r => setTimeout(r, 3000));

  let deleted = 0;
  for (const docSnap of toDelete) {
    await deleteDoc(doc(db, 'barbers', docSnap.id));
    deleted++;
    console.log(`  🗑️  Deleted ${docSnap.id} (${deleted}/${toDelete.length})`);
  }

  console.log(`\n✅ Done! Deleted ${deleted} fake barber accounts.`);
  process.exit(0);
}

cleanFakeBarbers().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
