# 🎯 Production Implementation Guide

## Complete Step-by-Step Walkthrough

This guide walks through the **entire booking system** showing exactly how data flows from customer → barber → back to customer in real-time.

---

## 📍 PART 1: AUTHENTICATION & USER PROFILES

### 1.1 Customer Registration

**User Journey**:
```
1. Opens app → clicks "Register"
2. Selects "I'm a Customer"
3. Enters: name, email, password
4. System creates Firebase Auth user + Firestore profile
```

**Code Flow**:

**File: `src/pages/auth/RegisterPage.tsx`**
```typescript
const handleSubmit = async () => {
  const user = await registerEmail({
    email: "ahmed@example.com",
    password: "secure123",
    name: "Ahmed Ali",
    phone: "+962791234567",
    role: "customer",
  });
  // user.uid = Firebase Auth UID
  loginCustomer(user.phone, user.name, user.uid);
};
```

**File: `src/lib/auth-providers.ts` (Line 143)**
```typescript
export async function registerEmail(data: {
  email: string;
  password: string;
  name: string;
  role: 'customer' | 'barber';
}): Promise<AuthUser> {
  // Step 1: Create Firebase Auth account
  const user = await signUpWithEmail(data.email, data.password, data.name);
  
  // Step 2: Write to users/{uid} collection
  await upsertUser(user.uid, {
    name: data.name,
    email: data.email,
    avatar: `https://i.pravatar.cc/150?u=${data.email}`,
    role: 'customer',
    loyaltyPoints: 0,
    totalBookings: 0,
  });
  
  return { uid: user.uid, name: data.name, email: data.email, provider: 'local' };
}
```

**Firestore Result** (`users/userId`):
```json
{
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "avatar": "https://i.pravatar.cc/150?u=ahmed@example.com",
  "role": "customer",
  "loyaltyPoints": 0,
  "totalBookings": 0,
  "createdAt": 1713696000000,
  "updatedAt": 1713696000000
}
```

---

### 1.2 Barber Registration

**User Journey**:
```
1. Opens app → clicks "Register"
2. Selects "I'm a Barber"
3. Enters: name, email, password, shop name, address
4. Taps "📍 Capture Location" → gets GPS coordinates
5. System creates user account + barber profile
```

**Code Flow**:

**File: `src/pages/auth/RegisterPage.tsx`**
```typescript
const handleSubmit = async () => {
  const user = await registerEmail({
    email: "barber@salon.com",
    password: "secure123",
    name: "Mohamed Hassan",
    phone: "+962795555555",
    role: "barber",
    shopName: "The Grand Barbershop",
    address: "Abdun, Amman",
    lat: 31.9454,  // GPS from "📍 Capture Location"
    lng: 35.9284,
  });
  
  loginBarber(user.email, user.uid, user.name, "The Grand Barbershop");
};
```

**File: `src/lib/auth-providers.ts`** (Line 143-175)
```typescript
export async function registerEmail(data): Promise<AuthUser> {
  const user = await signUpWithEmail(data.email, data.password, data.name);
  
  // Step 1: Create user profile
  await upsertUser(user.uid, {
    name: data.name,
    email: data.email,
    role: 'barber',
  });
  
  // Step 2: Create barber profile (only for barbers)
  if (data.role === 'barber') {
    await createBarberProfile(user.uid, {
      name: data.name,
      shopName: data.shopName,
      avatar: avatar,
      address: data.address,
    });
    
    // Step 3: Update with GPS location
    if (data.lat && data.lng) {
      await updateBarberProfile(user.uid, {
        lat: data.lat,
        lng: data.lng
      });
    }
  }
  
  return { uid: user.uid, ... };
}
```

**Firestore Results**:

`users/barberId`:
```json
{
  "name": "Mohamed Hassan",
  "email": "barber@salon.com",
  "role": "barber",
  "avatar": "...",
  "loyaltyPoints": 0
}
```

`barbers/barberId`:
```json
{
  "ownerUid": "barberId",
  "name": "Mohamed Hassan",
  "shopName": "The Grand Barbershop",
  "address": "Abdun, Amman",
  "lat": 31.9454,
  "lng": 35.9284,
  "services": [
    { "name": "Haircut", "duration": 30, "price": 20, "icon": "✂️" },
    { "name": "Beard", "duration": 15, "price": 10, "icon": "🧔" }
  ],
  "rating": 0,
  "reviewCount": 0,
  "queueCount": 0,
  "featured": false,
  "trustScore": 80,
  "avgDuration": 30,
  "followers": 0,
  "createdAt": 1713696000000,
  "updatedAt": 1713696000000
}
```

---

## 🎫 PART 2: BOOKING CREATION

### 2.1 Customer Selects Barber & Service

**UI Page**: `/barber-detail/:barberId`

**Code**: `src/pages/BarberDetailPage.tsx`
```typescript
// Display barber details and services
const barber = useBarber(barberId);

// Services from barber profile:
// [
//   { id: "s1", name: "Haircut", duration: 30, price: 20 },
//   { id: "s2", name: "Beard", duration: 15, price: 10 }
// ]

return (
  <>
    <BarberCard barber={barber} />
    {barber.services.map(service => (
      <ServiceItem service={service} />
    ))}
  </>
);
```

---

### 2.2 Customer Books Appointment

**UI Page**: `/booking/:barberId`

**User Steps**:
1. Select service (e.g., "Haircut")
2. Select date (e.g., "Tomorrow")
3. Select time (e.g., "14:30")
4. Add tip (optional)
5. Confirm booking

**Code**: `src/pages/BookingPage.tsx`

```typescript
const handleConfirm = async () => {
  // Get customer details
  const { customer } = useAuth();
  const { barber } = useBarber(barberId);
  
  // Get booking details from UI
  const selectedService = ...; // from state
  const selectedDate = DATES[selectedDay]; // "Jan 4, 2026"
  const selectedTime = ...; // "14:30"
  const tip = 5;
  
  try {
    // 🔥 CRITICAL: Create booking in Firestore
    const bookingId = await createFirestoreBooking({
      customerUid: customer.uid,           // "customerId_123"
      customerName: customer.name,         // "Ahmed Ali"
      customerPhone: customer.phone,       // "+962791234567"
      customerAvatar: customer.avatar,
      
      barberId: barber.id,                // "barberId_456"
      barberName: barber.name,            // "Mohamed Hassan"
      barberShop: barber.shopName,        // "The Grand Barbershop"
      barberAvatar: barber.avatar,
      
      service: selectedService,           // { name: "Haircut", price: 20, ... }
      date: selectedDate,                 // "Jan 4, 2026"
      time: selectedTime,                 // "14:30"
      
      totalPrice: selectedService.price + tip,  // 25
      pointsEarned: Math.round(selectedService.price * 2), // 40
    });
    
    // Booking created! Now update local state
    createBooking(
      barber.id,
      barber.id,
      selectedService,
      selectedDate,
      selectedTime,
      tip,
      'cash',
      undefined,
      bookingId  // Link to Firestore booking
    );
    
    toast.success("Booking confirmed!");
    navigate('/booking-status');
  } catch (err) {
    toast.error("Failed to create booking");
  }
};
```

---

### 2.3 Firestore Booking Creation

**File**: `src/lib/db.ts` (Line 199)

```typescript
export async function createBooking(data: Omit<BookingDoc, 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
  const { db, collection, addDoc } = await fs();
  const now = Date.now();
  
  // Step 1: Create booking document
  const ref = await addDoc(collection(db, COL.bookings), {
    ...data,
    status: 'requested',  // Initial status
    createdAt: now,
    updatedAt: now,
  });
  
  console.log('✅ Booking created:', ref.id);
  
  // Step 2: 🔔 SEND AUTOMATIC NOTIFICATION TO BARBER
  void pushNotification(data.barberId, {
    type: 'booking_request',
    title: '📥 New booking request',
    body: `${data.customerName} booked ${data.service?.name} on ${data.date} at ${data.time}`,
    bookingId: ref.id,
    fromUid: data.customerUid,
    fromName: data.customerName,
    fromAvatar: data.customerAvatar || '',
  });
  
  return ref.id;
}
```

**Firestore Result** (`bookings/bookingId123`):
```json
{
  "customerUid": "customerId_123",
  "customerName": "Ahmed Ali",
  "customerPhone": "+962791234567",
  "customerAvatar": "https://...",
  
  "barberId": "barberId_456",
  "barberName": "Mohamed Hassan",
  "barberShop": "The Grand Barbershop",
  "barberAvatar": "https://...",
  
  "service": {
    "id": "s1",
    "name": "Haircut",
    "duration": 30,
    "price": 20,
    "icon": "✂️"
  },
  
  "date": "Jan 4, 2026",
  "time": "14:30",
  "status": "requested",
  "totalPrice": 25,
  "pointsEarned": 40,
  "createdAt": 1713696300000,
  "updatedAt": 1713696300000
}
```

**Notification Created** (`notifications/notif123`):
```json
{
  "toUid": "barberId_456",
  "type": "booking_request",
  "title": "📥 New booking request",
  "body": "Ahmed Ali booked Haircut on Jan 4 at 14:30",
  "bookingId": "bookingId123",
  "fromUid": "customerId_123",
  "fromName": "Ahmed Ali",
  "fromAvatar": "https://...",
  "read": false,
  "createdAt": 1713696300000
}
```

---

## ⚡ PART 3: REAL-TIME SYNC

### 3.1 Customer Real-time Listener

**File**: `src/contexts/LiveBookingContext.tsx` (Line 119-135)

```typescript
// When customer logs in, subscribe to their bookings
useEffect(() => {
  if (!customer?.uid) return;
  
  const unsub = subscribeCustomerBookings(customer.uid, (bookings) => {
    // This callback fires INSTANTLY when any booking changes
    setBookings(bookings);
  });
  
  return () => unsub();
}, [customer?.uid]);
```

**What Happens**:
1. App attaches Firestore listener: `collection(db, 'bookings').where('customerUid', '==', customer.uid)`
2. Listener triggers on **any change** in real-time
3. Component re-renders with new booking list
4. Customer sees status updates instantly

---

### 3.2 Barber Real-time Listener

**File**: `src/contexts/LiveBookingContext.tsx` (Line 127-143)

```typescript
// When barber logs in, subscribe to their bookings
useEffect(() => {
  if (!barberUser?.uid) return;
  
  const unsub = subscribeBarberBookings(barberUser.uid, (bookings) => {
    // This callback fires INSTANTLY when any booking for this barber changes
    setBookings(bookings);
  });
  
  return () => unsub();
}, [barberUser?.uid]);
```

---

## 🎯 PART 4: BARBER ACCEPTS BOOKING

### 4.1 Barber Sees Pending Booking

**UI Page**: `/barber/bookings`

**Code**: `src/pages/barber/BarberBookingsPage.tsx`

```typescript
export default function BarberBookingsPage() {
  const { barberUser } = useAuth();
  const { allBookings, acceptBooking, rejectBooking } = useLiveBooking();
  
  // Filter to this barber's pending bookings
  const myBookings = allBookings.filter(b => b.barberId === barberUser.uid);
  const pending = myBookings.filter(b => b.status === 'requested');
  
  return (
    <div>
      {pending.map(booking => (
        <div key={booking.id}>
          <h3>{booking.customerName}</h3>
          <p>{booking.service.name} at {booking.time}</p>
          
          {/* 🎯 Accept Button */}
          <button onClick={() => acceptBooking(booking.id)}>
            ✅ Accept
          </button>
          
          {/* ❌ Reject Button */}
          <button onClick={() => rejectBooking(booking.id)}>
            ❌ Reject
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 4.2 Barber Accepts

**Code**: `src/contexts/LiveBookingContext.tsx` (Line 234-240)

```typescript
const acceptBooking = useCallback((id: string) => {
  // Step 1: Update local state immediately
  setBookings(prev => 
    prev.map(b => b.id === id && b.status === 'requested' 
      ? patchStatus(b, 'accepted')
      : b
    )
  );
  
  // Step 2: Persist to Firestore
  void updateBookingStatus(id, 'confirmed').catch(() => {});
  
  // Step 3: Simulate barber progress (queue movement)
  simulateBarberProgress(id);
});
```

---

### 4.3 Firestore Status Update

**File**: `src/lib/db.ts` (Line 221-267)

```typescript
export async function updateBookingStatus(bookingId: string, status: BookingDoc['status']) {
  const { db, doc, updateDoc, getDoc, increment } = await fs();
  
  const ref = doc(db, COL.bookings, bookingId);
  
  // Step 1: Update booking status in Firestore
  await updateDoc(ref, {
    status,
    updatedAt: Date.now()
  });
  
  // Step 2: If booking completed, award loyalty points
  if (status === 'completed') {
    try {
      const snap = await getDoc(ref);
      const booking = snap.data() as BookingDoc;
      
      // Increment customer's loyalty points
      const userRef = doc(db, COL.users, booking.customerUid);
      await updateDoc(userRef, {
        loyaltyPoints: increment(30),  // Fixed 30 points
        totalBookings: increment(1)
      });
    } catch (e) { /* ignore */ }
  }
  
  // Step 3: 🔔 NOTIFY CUSTOMER ABOUT STATUS CHANGE
  try {
    const snap = await getDoc(ref);
    const booking = snap.data() as BookingDoc;
    
    const statusMessages = {
      requested: '📥 Booking received',
      confirmed: '✅ Booking accepted!',  // ← This is what barber just triggered
      in_progress: '✂️ Your appointment started',
      completed: '🎉 Appointment complete',
      cancelled: '❌ Booking cancelled',
      rejected: '😔 Booking rejected',
    };
    
    // Send notification to customer
    await pushNotification(booking.customerUid, {
      type: 'booking_update',
      title: statusMessages[status],
      body: `${booking.barberName} · ${booking.service?.name}`,
      bookingId,
      fromUid: booking.barberId,
      fromName: booking.barberName,
      fromAvatar: booking.barberAvatar,
    });
  } catch (e) { /* ignore */ }
}
```

**Firestore Updates**:

`bookings/bookingId123`:
```json
{
  // ... (all previous fields)
  "status": "confirmed",  // ← CHANGED from 'requested'
  "updatedAt": 1713696600000  // ← Updated timestamp
}
```

`notifications/notif456` (NEW):
```json
{
  "toUid": "customerId_123",  // ← Sent to CUSTOMER
  "type": "booking_update",
  "title": "✅ Booking accepted!",
  "body": "Mohamed Hassan · Haircut",
  "bookingId": "bookingId123",
  "fromUid": "barberId_456",
  "fromName": "Mohamed Hassan",
  "fromAvatar": "https://...",
  "read": false,
  "createdAt": 1713696600000
}
```

---

## 🔔 PART 5: CUSTOMER GETS REAL-TIME NOTIFICATION

### 5.1 Real-time Notification Sync

**Customer's App** → `subscribeCustomerBookings()` listener fires

**Code**: `src/lib/db.ts` (Line 270-289)

```typescript
export function subscribeCustomerBookings(customerUid: string, cb: (bookings: ...) => void) {
  return onSnapshot(
    query(
      collection(db, COL.bookings),
      where('customerUid', '==', customerUid),
      orderBy('createdAt', 'desc')
    ),
    snap => {
      // 🔥 THIS FIRES INSTANTLY WHEN STATUS CHANGES
      const bookings = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      cb(bookings);
    }
  );
}
```

### 5.2 Notification Listener

**Customer also has a notifications listener** (`src/lib/db.ts` Line 490-512)

```typescript
export function subscribeNotifications(toUid: string, cb: ...) {
  return onSnapshot(
    query(
      collection(db, COL.notifications),
      where('toUid', '==', toUid),
      orderBy('createdAt', 'desc'),
      limit(50)
    ),
    snap => {
      // 🔔 THIS FIRES WHEN NEW NOTIFICATION CREATED
      const notifications = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      cb(notifications);
    }
  );
}
```

### 5.3 UI Reacts Instantly

**File**: `src/pages/BookingStatusPage.tsx`

```typescript
export default function BookingStatusPage() {
  const { activeBooking } = useLiveBooking();
  
  if (!activeBooking) return null;
  
  return (
    <div>
      {/* Status changes automatically as activeBooking.status changes */}
      <Status>
        {activeBooking.status === 'requested' && "⏳ Waiting for barber..."}
        {activeBooking.status === 'accepted' && "✅ Booking confirmed!"}
        {activeBooking.status === 'in_progress' && "✂️ Currently serving you"}
        {activeBooking.status === 'completed' && "🎉 Complete! +40 points"}
      </Status>
      
      {/* Toast notification also appears */}
      <Toast>✅ Mohamed Hassan accepted your booking!</Toast>
    </div>
  );
}
```

---

## 📋 PART 6: COMPLETE BOOKING LIFECYCLE

### Full Timeline Example

**14:00** - Customer books
```
BookingPage.tsx → createFirestoreBooking()
↓
Firestore: bookings/booking123 created with status='requested'
↓
Firestore: notifications/notif1 created for barber
↓
Barber's app receives real-time update → sees "New booking!" in pending tab
```

**14:05** - Barber accepts
```
BarberBookingsPage.tsx → acceptBooking()
↓
LiveBookingContext updates local state → UI shows "Accepted"
↓
updateBookingStatus(booking123, 'confirmed')
↓
Firestore: bookings/booking123.status = 'confirmed'
↓
Firestore: notifications/notif2 created for customer
↓
Customer's app receives real-time updates:
  1. Booking status changes to 'accepted'
  2. Toast shows "✅ Mohamed Hassan accepted!"
```

**14:35** - Customer arrives, barber starts
```
BarberBookingsPage.tsx → startBooking()
↓
updateBookingStatus(booking123, 'in_progress')
↓
Firestore: bookings/booking123.status = 'in_progress'
↓
Customer app: Status changes to "✂️ In progress"
```

**15:05** - Haircut done, barber completes
```
BarberBookingsPage.tsx → completeBooking()
↓
updateBookingStatus(booking123, 'completed')
↓
Firestore: bookings/booking123.status = 'completed'
↓
Firestore: users/customerId123.loyaltyPoints += 40
↓
Firestore: users/customerId123.totalBookings += 1
↓
Firestore: notifications/notif3 created for customer with "🎉 Complete!"
↓
Customer app:
  - Status changes to "🎉 Complete!"
  - Toast: "Appointment finished! +40 points"
  - Booking moved to "History"
```

---

## 🧪 Testing the Full Flow

### Test Scenario

**Setup**:
1. Open app in 2 browser tabs
2. Tab 1: Register as customer "Ahmed Ali"
3. Tab 2: Register as barber "Mohamed Hassan"

**Flow**:
```
Tab 1 (Customer):
  1. Go to home
  2. Click on "The Grand Barbershop"
  3. Tap "Book Now" → Select Haircut → Tomorrow → 14:30 → Confirm
  4. ⏳ Wait for barber... (should show "Waiting" status)

Tab 2 (Barber):
  1. Go to /barber/bookings
  2. 📥 See "New booking request" immediately in Pending tab
  3. Click ✅ Accept
  4. Booking moves to "Confirmed" tab
  5. Status shows "Confirmed"

Tab 1 (Customer):
  1. ✅ Status immediately updates to "Accepted!"
  2. Toast notification appears
  3. See "Mohamed Hassan accepted your booking"

Tab 2 (Barber):
  1. Click ▶️ Start when customer arrives
  2. Status moves to "In Progress"

Tab 1 (Customer):
  1. Status updates to "✂️ In Progress"

Tab 2 (Barber):
  1. Click ✓ Complete when done
  2. Status moves to "Completed"

Tab 1 (Customer):
  1. Status updates to "🎉 Complete!"
  2. Toast: "Appointment complete! +40 loyalty points"
  3. Booking moves to History tab
```

---

## ✅ Verification Checklist

- [ ] New customer can register (email/password)
- [ ] New barber can register with location
- [ ] Barber appears in customer's explore page
- [ ] Customer can book barber's service
- [ ] Barber receives real-time notification
- [ ] Barber can accept booking
- [ ] Customer receives real-time status update (accepted)
- [ ] Barber can start appointment
- [ ] Customer sees "In Progress" status
- [ ] Barber completes appointment
- [ ] Customer sees "Complete" + loyalty points
- [ ] Customer can view booking history

---

## 🐛 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Barber doesn't see booking | No real-time listener | Check `subscribeBarberBookings` is called on barber login |
| Status doesn't update | Firestore listener not attached | Ensure `useEffect` for subscriptions runs |
| Notifications don't appear | Notifications listener missing | Add `subscribeNotifications` to app |
| Points not awarded | Booking not marked completed | Check `updateBookingStatus` logic |
| Services empty | Barber didn't add services | Add default services on barber registration |

---

**This completes the end-to-end production flow!** 🎉
