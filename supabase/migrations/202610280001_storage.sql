-- 7alaqi image storage on Supabase, while Firebase Auth and Firestore remain
-- the app's identity and booking systems.
-- Run only after configuring the Supabase Firebase Auth integration for
-- Firebase project `halaqyapp` and deploying the Firebase callable functions.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('halaqi-media', 'halaqi-media', true, 10485760, array['image/*']),
  ('halaqi-chat', 'halaqi-chat', false, 10485760, array['image/*'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.booking_media_members (
  booking_id text not null,
  member_uid text not null,
  created_at timestamptz not null default now(),
  primary key (booking_id, member_uid)
);

alter table public.booking_media_members enable row level security;
revoke all on public.booking_media_members from anon, authenticated;
grant select on public.booking_media_members to authenticated;

drop policy if exists "Booking participants can read their media membership" on public.booking_media_members;
create policy "Booking participants can read their media membership"
  on public.booking_media_members
  for select
  to authenticated
  using (member_uid = (select auth.jwt()->>'sub'));

drop policy if exists "Upload own public media" on storage.objects;
create policy "Upload own public media"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'halaqi-media'
    and (storage.foldername(name))[1] in ('users', 'barbers', 'posts')
    and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
    and lower(coalesce(metadata->>'mimetype', '')) like 'image/%'
  );

drop policy if exists "Delete own public media" on storage.objects;
create policy "Delete own public media"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'halaqi-media'
    and (storage.foldername(name))[1] in ('users', 'barbers', 'posts')
    and (storage.foldername(name))[2] = (select auth.jwt()->>'sub')
  );

drop policy if exists "Booking members can read chat images" on storage.objects;
create policy "Booking members can read chat images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'halaqi-chat'
    and (storage.foldername(name))[1] = 'chats'
    and exists (
      select 1 from public.booking_media_members member
      where member.booking_id = (storage.foldername(name))[2]
        and member.member_uid = (select auth.jwt()->>'sub')
    )
  );

drop policy if exists "Booking members can upload their chat images" on storage.objects;
create policy "Booking members can upload their chat images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'halaqi-chat'
    and (storage.foldername(name))[1] = 'chats'
    and storage.filename(name) like (select auth.jwt()->>'sub') || '-%'
    and exists (
      select 1 from public.booking_media_members member
      where member.booking_id = (storage.foldername(name))[2]
        and member.member_uid = (select auth.jwt()->>'sub')
    )
    and lower(coalesce(metadata->>'mimetype', '')) like 'image/%'
  );

drop policy if exists "Delete own chat images" on storage.objects;
create policy "Delete own chat images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'halaqi-chat'
    and (storage.foldername(name))[1] = 'chats'
    and storage.filename(name) like (select auth.jwt()->>'sub') || '-%'
    and exists (
      select 1 from public.booking_media_members member
      where member.booking_id = (storage.foldername(name))[2]
        and member.member_uid = (select auth.jwt()->>'sub')
    )
  );
