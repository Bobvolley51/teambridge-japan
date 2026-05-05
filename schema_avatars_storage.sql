-- Avatar storage bucket + RLS policies
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- Create the bucket (public so avatar URLs work without auth tokens)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Allow authenticated users to upload their own avatar (INSERT)
create policy "avatar_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.jpg'
  );

-- Allow authenticated users to replace their own avatar (UPDATE / upsert)
create policy "avatar_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name = auth.uid()::text || '.jpg'
  );

-- Allow everyone to read avatars (required for public getPublicUrl())
create policy "avatar_select"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');
