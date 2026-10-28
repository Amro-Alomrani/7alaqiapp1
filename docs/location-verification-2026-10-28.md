# Registration location investigation — 28 October 2026

## Observed on the local browser

- The registration request entered its loading state and returned an error after approximately 22 seconds without a position.
- A temporary diagnostic page on the same origin called browser geolocation directly, without React, Leaflet, Firebase, Supabase, or reverse geocoding. It reported a secure context, geolocation available, Permissions Policy allowing geolocation, and permission state `prompt`.
- That direct request returned browser error code 3 (`Timeout expired`) after 6002 ms, without returning a position. The diagnostic did not store or display coordinates. The production rebuild removed the temporary page.
- The evidence establishes a device/browser location-provider timeout in this environment. It does not establish whether the underlying cause is Windows location settings, permission mediation in the in-app browser, network-provider access, or unavailable positioning hardware. A live successful device fix has not been verified.
- Chrome comparison could not be completed because the computer-use tool stopped when it could not determine the current Windows browser URL confidently.

## Changes

- Added a separate application deadline, including providers that never invoke a callback. Permission waiting and fallback attempts cannot keep a one-shot request pending indefinitely.
- All attempts share the caller's total time budget; fallback preserves `maximumAge: 0` when a fresh position is required.
- Browser registration requests the device/network location without requiring high-accuracy GPS, with an eight-second total deadline. Native registration retains high accuracy with a twenty-second total budget.
- Cancellation prevents stale requests from changing the selection after manual map input, role changes, or leaving registration.
- The returned device pin opens on the map for verification. Manual pins can be dragged; timeouts open the map without assigning a default location to the account.

## Checks

- Six regression tests passed: no callback, total fallback deadline, denial without retry, prototype-based browser coordinate getters, invalid coordinates, cancellation/late callbacks, and already-aborted requests.
- TypeScript, ESLint for the changed files, and the production build passed.
- Browser/device positioning success and physical Android GPS remain unverified. Passing these regression tests is not a GPS availability claim.
