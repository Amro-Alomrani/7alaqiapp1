# 7alaqi — Google Play Data safety answers

Source review: 29 October 2026, Android 1.0.5 (6). Prepared answers, **not submitted to Play Console**. Recheck if SDKs, configuration, providers or enabled features change.

## General answers

- Privacy: https://halaqyapp.web.app/privacy.html
- Account deletion: https://halaqyapp.web.app/delete-account.html
- Support: 7alaqi.suuport@gmail.com
- Collects data: **Yes**.
- Encrypts collected data in transit: **Yes** (HTTPS/TLS; Android cleartext disabled).
- Account creation: **Username/email and password**. Dormant Google/Apple helpers are not an enabled login option in the reviewed UI.
- Account deletion: **Yes**, via Profile → Request account and data deletion, or the public URL. Both roles return from login to deletion.
- Independent security review/certification: **No**; local tests are not an independent certification.
- Advertising: **No advertising SDK or ads enabled**.
- Deleting all data without deleting the account: do not claim a separate complete service. Users can edit supported content or contact support; the verified automated path deletes the account and associated data.

## Data types to enter

All rows are collected, account-linked where applicable, and **not ephemeral-only**. Optional means the user can avoid the feature; salon fields can be required for barbers although optional for customers.

| Category/type | Required or optional | Purposes | Evidence |
| --- | --- | --- | --- |
| Personal info / Name | Required | Account management; App functionality | Account and barber profiles |
| Personal info / Email address | Required | Account management; App functionality; Fraud prevention, security and compliance | Firebase authentication |
| Personal info / User IDs | Required | Account management; App functionality; Fraud prevention, security and compliance | Firebase UID and ownership verification |
| Personal info / Phone number | Required for customers; collected when provided by barbers | Account management; App functionality | Registration and booking contact details |
| Personal info / Address | Optional overall; required for salon/home service | App functionality | Salon and home-service addresses |
| Location / Approximate location | Optional device permission; salon pin required for barbers | App functionality | Coarse permission and approximate provider results |
| Location / Precise location | Optional device permission; manual pin available | App functionality | Salon pin, booking location, nearby maps/routes |
| Photos and videos / Photos | Optional | App functionality | Profile, salon, service, post and private chat images |
| Messages / Other in-app messages | Optional | App functionality | Booking chat in Firestore |
| Financial info / Purchase history | Optional (when booking) | App functionality | Services, prices, tips, statuses/history; cash still creates transaction records |
| Financial info / Other financial info | Optional (barber features) | App functionality | Stored barber earnings/payout history; no bank/card credentials |
| App activity / App interactions | Optional (feature use) | App functionality | Bookings, follows, favorites and notifications |
| App activity / Other user-generated content | Optional | App functionality | Reviews, post text, descriptions, booking notes |
| Device or other IDs | Push optional; service security identifiers may be required | App functionality; Fraud prevention, security and compliance | FCM token, Firebase installation/service request identifiers |

Do not select contacts, SMS, audio, videos, calendar, browsing history, installed apps, card details, advertising identifiers, health data or an analytics/crash-reporting SDK: none is enabled by the inspected app. The code does not persist in-app search history. Provider operational/security logs are disclosed in the policy; no client analytics events are sent.

## Sharing

Google excludes qualifying service providers and user-initiated transfers from its definition of sharing:

- Firebase/Supabase process account, booking, media, deletion and notification data for 7alaqi. Select **not shared** for those provider transfers, subject to their applicable agreements.
- Intentional booking messages/contact exchanges and publishing salon/posts are user-initiated transfers disclosed in the policy; these normally qualify for the exception.
- For **precise and approximate location**, select **shared → App functionality** conservatively. Public map tiles, Nominatim and OSRM receive requested map areas/coordinates; their operators have not all been established as contracted service providers. Google Maps directions open at the user's request.
- No sale of data, advertising profiles or marketing sharing is implemented.

## Services and deletion

Firebase Auth/Firestore remain the account/database systems. Supabase hosts images and server functions that verify Firebase identity tokens, enforce image/chat access, delete accounts and relay FCM messages through Google. Passwords and administrative keys are never included in the client bundle. Public media and private chat images use separate buckets; uploads use an authenticated proxy.

The deployed deletion workflow removes Firebase Auth, profiles, associated bookings/messages/reviews/posts/follows/notifications and uploaded media in Supabase and legacy Firebase Storage. It continues asynchronously with bounded retries. Prior live temporary-account testing reached `deleted`; local tests cover authorization, retries, races and cleanup. This is not a certification of every production dataset.

After completion, account locks expire after 2 hours and minimal job statuses after 24 hours, then the next worker cleanup removes them. Random resource tombstones remain without account IDs/content to prevent recreation. Failed jobs retain necessary state until resolved. Provider operational/security logs follow their retention policies; do not promise instant deletion of all provider logs or backups.

## Remaining Console/device work

- Enter and submit these answers in Play Console; this document does not submit them.
- Ensure the store developer identity matches the operator and the support mailbox is monitored.
- Verify GPS, background push, image picking and lifecycle on the signed Android build; web tests do not cover those native paths.
- AI-provider calls and unconfigured QR/referral rewards are disabled; do not advertise them.
- Supply dedicated reviewer accounts under App access; never publish passwords in Git or screenshots.

## Official references

- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)
- [Restricted permissions](https://support.google.com/googleplay/android-developer/answer/16935362?hl=en)
