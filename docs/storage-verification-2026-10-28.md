# Supabase media verification — 28 October 2026

Scope: new image uploads use Supabase Storage. Firebase Authentication and Firestore remain the source for users and bookings.

## Deployed resources

- Project: `vjeuesqrzywragnjvkpi`.
- Public bucket: `halaqi-media`, images only, 10 MB per object.
- Private bucket: `halaqi-chat`, images only, 10 MB per object.
- API: `https://vjeuesqrzywragnjvkpi.supabase.co/functions/v1/media`.
- The Edge Function validates Firebase tokens with Google for project `halaqyapp` and checks private-image booking participants with Firestore before issuing signed links.
- No anonymous write policy was added. A Firebase token alone does not authorize another account's upload folder.

## Verification performed

- Nine local authorization and lifecycle tests passed: owner paths, participant access, outsider denial, invalid or wrong-project identity, size/type rejection, exact recursive cleanup, and redacted provider failures.
- A live owner account uploaded a public profile test image and downloaded the matching bytes.
- An anonymous request was denied permission to upload; a different account was denied access to the owner's folder.
- A live booking customer uploaded a private chat image. Its public URL did not expose the image.
- The booking's barber received a signed download URL and downloaded the matching bytes.
- A third Firebase account could not obtain the private image URL; the barber could not delete the customer's image.
- Owner deletion and cleanup completed. All temporary Auth accounts, the private test booking, and test image objects were removed (`test_cleanup_failures=0`).

## Limits

The tests used disposable accounts and a non-public booking on the real services. They were not an Android-device test. Account deletion and the booking push worker now run from Supabase Edge Functions because the Firebase project has billing disabled; actual push delivery still requires a physical device with a registered FCM token.

The bootstrap secret provided in the chat is not in source control or the client bundle. The deployed Edge Function uses the server credential supplied by the Supabase runtime. Revoke the exposed bootstrap secret after the integration check.
