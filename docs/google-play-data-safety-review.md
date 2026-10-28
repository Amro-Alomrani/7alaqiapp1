# Google Play Data safety worksheet — 7alaqi

Prepared from the current source tree on 28 October 2026. This is a review worksheet for the Play Console, not a submitted declaration. Confirm these choices against production Firebase settings and the final released build before submitting.

## Data handled by app features

| Play Console category | Data in this app | Collection / purpose | Sharing and notes |
| --- | --- | --- | --- |
| Personal info — name | Customer and barber names | Collected at account setup; account operation, bookings, messages, and profiles | Stored in Firebase; barber display name/shop fields may be public when published |
| Personal info — email address | Authentication/account email | Account management and authentication | Firebase Authentication |
| Personal info — phone number | Customer/barber phone | Account and booking communication | Stored in Firebase; shown to booking participants where the UI exposes it |
| Personal info — user IDs | Firebase UID and role | Account operation, access control, and records | Firebase Authentication / Firestore |
| Location — precise location | Device GPS or map-pin coordinates; check-in and optional home-service / live booking location | User initiated location/map/check-in; app functionality | Firebase for booking/check-in; OpenStreetMap tiles receive map viewport/network address; Nominatim/OSRM receive requested coordinates for reverse geocoding/routes; Google Maps receives route coordinates only when directions are opened. No background location permission is declared. |
| Photos and videos — photos | Profile, salon, service, gallery/post, and booking-chat image uploads | User supplied content, profile display, messaging | Firebase Storage; public barber/post/service images may be publicly viewable under current rules; booking-chat images are associated with the booking |
| Messages — other in-app messages | Booking chat messages and notes | Booking communication | Firebase Firestore; visible to booking participants |
| App activity — app interactions | Booking requests/status, chosen service/time, reviews, follows, check-ins, and loyalty activity | Core app operation | Firebase Firestore |
| Device or other IDs | FCM registration token | Push notifications | Stored in Firebase; used by Firebase Cloud Messaging to deliver notifications |

## Data safety answers to review

- Data is collected only to operate the account, bookings, messaging, maps/location, profile content, loyalty/check-in, and notifications described above.
- No advertising SDK or sale of personal information was found in the current source tree.
- The in-app assistant is currently disabled and responds from local app data; its public UI says messages are not sent to an AI provider. Confirm this remains true in the release.
- The app uses HTTPS for configured service requests. Confirm network security and production endpoints in the final build.
- Account deletion is available in-app and through the public deletion page. Confirm the deployed deletion Cloud Function and production rules are current and test deletion against production test accounts before declaring deletion complete.
- Do not select “data is not shared” without reviewing the Play Console’s definitions for service providers and the configured Firebase/maps integrations.
- Confirm whether profile photos, posts, and salon/service photos are public, whether any analytics/crash reporting SDK is added by Firebase Console or native configuration, and whether production FCM is active.
- The current customer booking UI selects cash only. The stored booking schema still permits a legacy wallet value, so verify production data and any barber-facing payout information before declaring that no financial data is collected. The app does not collect card credentials in the inspected booking UI.

## Still required before Play Console submission

1. A monitored public privacy/support email has been supplied and added to the local policy pages. The updated policy still needs deployment to the public Firebase Hosting site.
2. A logged-in customer and barber test session to verify screenshots, booking delivery, maps, profile, and notification paths with authentic production data.
3. Firebase production verification: deployed Firestore/Storage rules and Cloud Functions, live deletion flow, and a real Android FCM delivery test.
4. Review the final release APK/AAB and any Firebase Console SDK/configuration against this worksheet. Then enter the answers in Play Console and submit its Data safety form.
