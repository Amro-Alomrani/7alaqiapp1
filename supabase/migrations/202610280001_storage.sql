-- Supabase stores media; the media Edge Function checks Firebase identity and
-- booking membership, then issues a signed token for one object.
-- Direct anonymous/authenticated INSERT/UPDATE/DELETE access stays closed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('halaqi-media', 'halaqi-media', true, 10485760, array['image/*']),
  ('halaqi-chat', 'halaqi-chat', false, 10485760, array['image/*'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Remove grants from the previous, unapplied third-party-auth draft if present.
-- No user records or media files are deleted.
drop policy if exists "Upload own public media" on storage.objects;
drop policy if exists "Delete own public media" on storage.objects;
drop policy if exists "Booking members can read chat images" on storage.objects;
drop policy if exists "Booking members can upload their chat images" on storage.objects;
drop policy if exists "Delete own chat images" on storage.objects;
