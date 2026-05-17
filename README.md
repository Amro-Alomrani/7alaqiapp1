# 🧔 Halaqi Jo - Barber Booking Mobile App

**Production-ready real-time barber booking system** built with React, Firebase, and TypeScript.

- ✅ Real Firebase Authentication (email, phone, Google)
- ✅ Real Firestore database with real-time sync
- ✅ Complete booking system (create → accept/reject → complete)
- ✅ Real-time notifications (no polling)
- ✅ Loyalty points system
- ✅ Mobile-ready (Capacitor for iOS/Android)
- ✅ Bilingual (Arabic/English)

## 🚀 Quick Start

### Development Server
```bash
npm install
npm run dev
```
Opens: http://localhost:5173

### Test Booking Flow
1. Open 2 browser tabs (or incognito)
2. Tab 1: Register as customer
3. Tab 2: Register as barber
4. Tab 1: Book a service
5. Tab 2: Accept booking
6. Tab 1: See real-time status update ⚡

## 📚 Documentation

Start here for complete information:

1. **[SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md)** - Quick summary & quick start
2. **[PRODUCTION_ARCHITECTURE.md](./PRODUCTION_ARCHITECTURE.md)** - Full technical architecture
3. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Step-by-step code walkthrough  
4. **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - What to fix before launch

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Backend | Firebase (BaaS) |
| Database | Firestore (real-time) |
| Auth | Firebase Authentication |
| Mobile | Capacitor (iOS/Android) |
| Styling | TailwindCSS + shadcn/ui |

## 📊 Key Features

### For Customers
- Register with email/phone/Google
- Browse barbers with ratings
- Book appointments in real-time
- Get instant notifications (accepted/rejected/in progress/completed)
- View booking history
- Earn loyalty points

### For Barbers  
- Set up shop profile with location
- Manage services & pricing
- Accept/reject incoming bookings
- Start & complete appointments
- View earnings
- Track ratings & reviews

## 🔥 Real-time Booking Flow

```
Customer Books              Barber Accepts
      ↓                          ↓
Firestore: +booking        Firestore: status=confirmed
      ↓                          ↓
Auto notify barber         Customer notified INSTANTLY
      ↓                          ↓
No polling needed!         Real-time sync in <1s
```

## 🔐 Security

**Current**: Demo mode (dev/testing)  
**Production**: Deploy Firestore security rules before launch

```bash
firebase deploy --only firestore:rules
```

[See PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) for detailed rules.

## 📱 Mobile Build

### Android
```bash
npm run build
npx cap add android  
npx cap open android
# Build in Android Studio
```

### iOS  
```bash
npm run build
npx cap add ios
npx cap open ios  
# Build in Xcode
```

## 🧪 Testing

**Scenario**: Test complete booking flow

```
Terminal 1 (Customer)                Terminal 2 (Barber)
─────────────────────                ───────────────────
1. http://localhost:5173             Same URL
2. Register as customer              Register as barber
3. Email: ahmed@test.com             Email: barber@test.com
4. Click shop                         Log out & back in as barber
5. Book service for tomorrow         See "Pending" tab
6. Wait... ⏳                         Click ✅ Accept
7. See "Confirmed!" ⚡               See "Accepted"
8. ...                               Click ▶️ Start
9. See "In Progress" ⚡              
10. ...                              Click ✓ Complete
11. See "Complete + 40 pts" ⚡       Booking in "Completed"
```

## 📂 Project Structure

```
src/
├── pages/
│   ├── auth/          # Login, register, role selection
│   ├── barber/        # Barber dashboard, bookings
│   └── [customers]    # Home, explore, booking, history
├── components/
│   ├── ui/            # Button, Card, etc (shadcn)
│   └── [features]     # BarberCard, BookingSteps, etc
├── contexts/
│   ├── AuthContext.tsx            # Login state
│   ├── LiveBookingContext.tsx      # Booking + real-time
│   ├── DataContext.tsx            # Barbers list
│   └── NotificationsContext.tsx   # Notifications
├── lib/
│   ├── firebase.ts                # Firebase SDK
│   ├── db.ts                      # Firestore CRUD
│   ├── auth-providers.ts          # Auth logic
│   ├── realtime.ts                # Event bus
│   └── utils.ts                   # Helpers
└── types/
    └── index.ts                    # TypeScript interfaces
```

## 🔌 Key Modules

| File | Purpose | Key Functions |
|------|---------|---|
| `lib/db.ts` | Firestore operations | `createBooking`, `updateBookingStatus`, `subscribeCustomerBookings` |
| `contexts/LiveBookingContext.tsx` | Booking state + real-time | `acceptBooking`, `completeBooking`, real-time listeners |
| `lib/auth-providers.ts` | Authentication | `registerEmail`, `loginEmail`, `sendPhoneOTP` |
| `pages/BookingPage.tsx` | Booking UI | Customer selects & confirms booking |
| `pages/barber/BarberBookingsPage.tsx` | Barber management | Accept/reject/start/complete |

## 🌍 Firebase Project

- **Project ID**: `halaqyapp`
- **Auth Domain**: `halaqyapp.firebaseapp.com`
- **Firestore**: Real-time document database
- **Storage**: Bucket for images

## 📖 Learning Resources

### Understanding the Code
1. Start: Read `SYSTEM_OVERVIEW.md` (5 min)
2. Architecture: `PRODUCTION_ARCHITECTURE.md` (15 min)
3. Code Flow: `IMPLEMENTATION_GUIDE.md` (30 min)
4. Key Files:
   - `src/lib/firebase.ts` - Firebase setup
   - `src/lib/db.ts` - Database layer
   - `src/contexts/LiveBookingContext.tsx` - Real-time state
   - `src/pages/BookingPage.tsx` - Customer flow
   - `src/pages/barber/BarberBookingsPage.tsx` - Barber flow

### Firebase Documentation
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Real-time Listeners](https://firebase.google.com/docs/firestore/query-data/listen)
- [Authentication](https://firebase.google.com/docs/auth)

## ⚙️ Available Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview build
npm run lint     # Run ESLint
```

## 📋 Production Checklist

Before deploying to production:

- [ ] Review `PRODUCTION_CHECKLIST.md`
- [ ] Deploy Firestore security rules
- [ ] Set up environment variables
- [ ] Test on physical Android/iOS devices
- [ ] Configure payment processing (optional)
- [ ] Set up Firebase Cloud Messaging
- [ ] Enable analytics

[See PRODUCTION_CHECKLIST.md for details →](./PRODUCTION_CHECKLIST.md)

## 🐛 Troubleshooting

**Barber doesn't see booking?**
- Check barber is logged in
- Check barber's subscription listener is active
- Open browser DevTools → Network → check Firestore calls

**Status doesn't update?**
- Check booking listener is subscribed
- Open Firestore Console → check booking document
- Reload page (should sync)

**Can't book?**
- Check Firebase credentials in `firebase.ts`
- Check network tab for errors
- Check browser console for errors

## 📞 Support

- **Firebase Issues**: https://firebase.google.com/support
- **GitHub Issues**: [Report a bug](./issues)
- **Documentation**: See `PRODUCTION_ARCHITECTURE.md`

## 📄 License

MIT

---

**Built for barber shops in Jordan** ✂️🇯🇴  
Production engineering. Real data. Real-time. No mocks.

      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
