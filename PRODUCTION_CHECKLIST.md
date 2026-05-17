# 🚀 PRODUCTION READINESS CHECKLIST

## Current Status: 85% Complete

The booking system is **fully functional** for development/testing.  
Below are the **critical** and **important** items needed before going live.

---

## 🔴 CRITICAL (MUST FIX BEFORE LAUNCH)

### 1. Firestore Security Rules
**Status**: ❌ In Demo Mode (UNSAFE)  
**Impact**: All reads/writes allowed - anyone can modify any booking/user

**Action**:
1. Open `firestore.rules`
2. Replace with production rules (see [PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md#-security-rules-to-be-deployed))
3. Deploy: `firebase deploy --only firestore:rules`
4. Test:
   ```bash
   # Verify unauthenticated user CANNOT read bookings
   curl "https://firestore.googleapis.com/v1/projects/halaqyapp/databases/(default)/documents/bookings" \
     -H "Content-Type: application/json"
   # Should get: 401 Unauthenticated
   ```

**File to Update**: `firestore.rules`

---

### 2. User Data Persistence on Registration
**Status**: ⚠️ Partial  
**Issue**: User profiles not fully populated on first login

**Current Flow**:
```
registerEmail() → creates user in Firestore
                → but name/phone may be incomplete
```

**Action**: Enhance registration to capture and validate all fields

**Code to Add** (`src/lib/auth-providers.ts`):
```typescript
export async function registerEmail(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'customer' | 'barber';
  shopName?: string;
  address?: string;
  lat?: number;
  lng?: number;
}): Promise<AuthUser> {
  // Validate required fields
  if (!data.email || !data.password || !data.name) {
    throw new Error('Email, password, and name are required');
  }
  
  if (data.role === 'barber' && (!data.shopName || !data.address)) {
    throw new Error('Barbers must provide shop name and address');
  }
  
  // ... rest of implementation
}
```

---

### 3. Barber Services Configuration
**Status**: ⚠️ Partial  
**Issue**: Barbers have default services; no UI to add custom services

**Current**:
```json
{
  "services": [
    { "name": "Haircut", "price": 20, "duration": 30 },
    { "name": "Beard", "price": 10, "duration": 15 }
  ]
}
```

**Action**: Create barber services management UI

**New File**: `src/pages/barber/BarberServicesPage.tsx`
```typescript
export default function BarberServicesPage() {
  const { barberUser } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [newService, setNewService] = useState({ name: '', price: 0, duration: 30 });
  
  useEffect(() => {
    if (!barberUser) return;
    getBarber(barberUser.uid).then(barber => {
      setServices(barber?.services || []);
    });
  }, [barberUser]);
  
  const handleAddService = async () => {
    const updated = [...services, newService];
    await updateBarberProfile(barberUser.uid, { services: updated });
    setServices(updated);
    setNewService({ name: '', price: 0, duration: 30 });
  };
  
  return (
    <div>
      <h1>Manage Services</h1>
      
      {services.map(service => (
        <ServiceRow key={service.id} service={service} />
      ))}
      
      <div>
        <input
          placeholder="Service name"
          value={newService.name}
          onChange={e => setNewService({ ...newService, name: e.target.value })}
        />
        <input
          type="number"
          placeholder="Price"
          value={newService.price}
          onChange={e => setNewService({ ...newService, price: Number(e.target.value) })}
        />
        <input
          type="number"
          placeholder="Duration (min)"
          value={newService.duration}
          onChange={e => setNewService({ ...newService, duration: Number(e.target.value) })}
        />
        <button onClick={handleAddService}>+ Add Service</button>
      </div>
    </div>
  );
}
```

**Add to barber routes**: `/barber/services`

---

### 4. Appointment Availability / Working Hours
**Status**: ❌ NOT IMPLEMENTED  
**Issue**: No time slot validation against barber's working hours

**Current**: All times offered (08:00 - 20:00)  
**Needed**: Respect barber's working hours and booked slots

**Action**: Add work_hours collection

**Schema** (`barbers/{barberId}/work_hours/{day}`):
```json
{
  "day": "Monday",
  "startTime": "09:00",
  "endTime": "18:00",
  "isOpen": true
}
```

**Code to Add** (`src/lib/db.ts`):
```typescript
export interface WorkHours {
  day: string;
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  isOpen: boolean;
}

export async function updateBarberWorkHours(barberId: string, hours: WorkHours[]) {
  const { db, doc, setDoc } = await fs();
  const ref = doc(db, 'barbers', barberId, 'work_hours', 'schedule');
  await setDoc(ref, { hours, updatedAt: Date.now() });
}

export async function getAvailableTimeSlots(barberId: string, date: string): Promise<string[]> {
  // Get barber's work hours
  const workHours = await getDoc(doc(db, 'barbers', barberId, 'work_hours', 'schedule'));
  if (!workHours.exists()) return ALL_TIMES;
  
  const { startTime, endTime } = workHours.data().hours[new Date(date).getDay()];
  
  // Get existing bookings for this date
  const bookings = await getDocs(query(
    collection(db, 'bookings'),
    where('barberId', '==', barberId),
    where('date', '==', date),
    where('status', 'in', ['requested', 'confirmed', 'in_progress'])
  ));
  
  const bookedTimes = new Set(bookings.docs.map(d => d.data().time));
  
  // Generate available slots
  const available: string[] = [];
  for (let h = parseInt(startTime); h < parseInt(endTime); h++) {
    const time = `${h}:00`;
    if (!bookedTimes.has(time)) {
      available.push(time);
    }
  }
  
  return available;
}
```

---

## 🟡 IMPORTANT (SHOULD FIX BEFORE LAUNCH)

### 5. Payment Processing
**Status**: ❌ NOT IMPLEMENTED  
**Impact**: No way to collect payment

**Recommended**: Stripe + Capacitor Payment Plugin

**Setup**:
```bash
npm install @stripe/stripe-js stripe
npx cap plugin add stripe
```

**Code**: `src/lib/payments.ts`
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY);

export async function createPaymentIntent(bookingId: string, amount: number) {
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),  // cents
    currency: 'jod',  // Jordanian Dinar
    metadata: { bookingId }
  });
  return intent.clientSecret;
}
```

---

### 6. Push Notifications (Mobile)
**Status**: ⚠️ Partial (Web only)  
**Issue**: Mobile users won't get push notifications

**Fix**: Set up Firebase Cloud Messaging

**Steps**:
1. Go to Firebase Console → Cloud Messaging
2. Download server key
3. Create Cloud Function to send FCM:

**File**: `functions/index.js`
```javascript
const admin = require('firebase-admin');
admin.initializeApp();

exports.onBookingStatusChange = admin.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const booking = change.after.data();
    const recipient = booking.status === 'confirmed' 
      ? booking.customerUid 
      : booking.barberId;
    
    const message = {
      notification: {
        title: '📥 New Booking',
        body: `${booking.customerName} booked ${booking.service.name}`
      },
      android: {
        priority: 'high'
      },
      apns: {
        headers: { 'apns-priority': '10' }
      }
    };
    
    const user = await admin.firestore().collection('users').doc(recipient).get();
    if (user.data().fcmToken) {
      await admin.messaging().sendToDevice(user.data().fcmToken, message);
    }
  });
```

**Deploy**:
```bash
firebase deploy --only functions
```

---

### 7. Barber Queue Management
**Status**: ⚠️ Partial (local simulation)  
**Issue**: Queue positions are simulated, not real

**Current**: Queue moves automatically after acceptance  
**Needed**: Track actual wait times

**Action**: Implement real queue tracking

**Code**: `src/lib/db.ts`
```typescript
export async function getBarberQueue(barberId: string) {
  const bookings = await getDocs(query(
    collection(db, 'bookings'),
    where('barberId', '==', barberId),
    where('status', 'in', ['accepted', 'preparing', 'in_progress']),
    orderBy('time', 'asc')
  ));
  
  return bookings.docs.map((doc, index) => ({
    ...doc.data(),
    position: index + 1,
    estimatedWaitTime: index * 30  // 30 min per cut
  }));
}
```

---

### 8. Loyalty Points Redemption
**Status**: ❌ NOT IMPLEMENTED  
**Issue**: Points earned but can't be used

**Action**: Add points redemption logic

**Schema**: Add to `bookings` document
```json
{
  "pointsUsed": 0,
  "pointsEarned": 40,
  "discountApplied": 0
}
```

**Code**: `src/lib/db.ts`
```typescript
export async function applyLoyaltyDiscount(customerId: string, points: number) {
  const user = await getDoc(doc(db, 'users', customerId));
  const available = user.data().loyaltyPoints;
  
  if (available < points) {
    throw new Error('Insufficient loyalty points');
  }
  
  // 1 point = $0.01 discount
  const discount = points * 0.01;
  
  return discount;
}
```

---

### 9. Rating & Review System
**Status**: ⚠️ Partial  
**Issue**: Reviews stored but no UI to leave/view them

**Action**: Create rating flow after booking completion

**New File**: `src/pages/RateBookingPage.tsx`
```typescript
export default function RateBookingPage() {
  const { bookingId } = useParams();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await addReview(bookingId, rating, comment);
      toast.success('Review submitted!');
      navigate('/history');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <h1>How was your experience?</h1>
      <StarRating value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Share your feedback..."
      />
      <Button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Review'}
      </Button>
    </div>
  );
}
```

---

### 10. Analytics & Monitoring
**Status**: ❌ NOT IMPLEMENTED

**Action**: Add Firebase Analytics

```bash
npm install firebase
```

**Code**: `src/lib/analytics.ts`
```typescript
import { getAnalytics, logEvent } from 'firebase/analytics';

const analytics = getAnalytics(app);

export function trackBookingCreated(barberId: string, servicePrice: number) {
  logEvent(analytics, 'booking_created', {
    barber_id: barberId,
    service_price: servicePrice
  });
}

export function trackBookingAccepted(bookingId: string) {
  logEvent(analytics, 'booking_accepted', { booking_id: bookingId });
}
```

---

## 🟢 NICE TO HAVE (POST-LAUNCH)

### 11. AI Barber Recommendations
- Use Grok AI to suggest barbers based on style history
- Currently in `lib/grok-ai.ts` (partially implemented)

### 12. In-app Chat
- Add real-time chat between customer and barber
- Use Firestore subcollection `bookings/{bookingId}/messages`

### 13. Geolocation Map View
- Show nearby barbers on map
- Already have lat/lng in barber profiles

### 14. Barber Availability Calendar
- Visual calendar showing booked vs. available slots
- Can be added to `BarberServicesPage`

### 15. Promotions & Discount Codes
- Admin panel to create promo codes
- Add `promos` collection to Firestore

---

## 📋 Implementation Priority

### Week 1 (Security + Core)
- [ ] Fix Firestore Rules (CRITICAL)
- [ ] Set up payment processing (Stripe)
- [ ] Implement work hours/time slots

### Week 2 (Features)
- [ ] Barber services UI
- [ ] Rating & review flow
- [ ] Queue management

### Week 3 (Polish)
- [ ] FCM push notifications
- [ ] Analytics
- [ ] Error handling & edge cases

---

## ✅ Pre-Launch Testing Checklist

### Authentication
- [ ] Email registration works
- [ ] Phone OTP works (or fallback)
- [ ] Google login works
- [ ] Can't register with duplicate email
- [ ] Can't access barber pages as customer

### Bookings
- [ ] Can create booking in Firestore
- [ ] Barber receives notification instantly
- [ ] Status changes sync in real-time
- [ ] Loyalty points awarded on completion
- [ ] Booking history shows all past bookings

### Security
- [ ] Unauthenticated user can't read bookings
- [ ] Customer can only see their own bookings
- [ ] Barber can only modify their own bookings
- [ ] Can't access other user's profile data

### Performance
- [ ] Load home page in < 3s
- [ ] Real-time updates in < 1s
- [ ] No console errors
- [ ] Mobile responsive at 375px

---

## 📞 Support Contacts

- **Firebase Support**: https://firebase.google.com/support
- **Stripe Support**: https://support.stripe.com
- **Capacitor Issues**: https://github.com/ionic-team/capacitor/issues

---

**Version**: 1.0  
**Last Updated**: April 21, 2026  
**Author**: Production Engineer
