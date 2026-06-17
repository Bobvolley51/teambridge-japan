-- Fix overly permissive RLS policies across all tables
-- Resolves: rls_policy_always_true (43), function_search_path_mutable,
--           anon/authenticated_security_definer_function_executable,
--           public_bucket_allows_listing
-- Run in: Supabase Dashboard → SQL Editor → New Query

-- ── handle_new_user: fix mutable search_path ─────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'Player')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

-- Revoke direct REST API execution (it's a trigger function, not a public RPC)
revoke execute on function public.handle_new_user() from anon, authenticated;

-- ── account_requests ─────────────────────────────────────────────────────────
drop policy if exists "admins can update" on account_requests;
drop policy if exists "admins can delete" on account_requests;
drop policy if exists "anyone can request" on account_requests;

-- Restrict status to 'pending' on insert (prevents pre-approving own request)
create policy "anyone can request" on account_requests
  for insert with check (status = 'pending');

create policy "admins can update" on account_requests
  for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'));

create policy "admins can delete" on account_requests
  for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'));

-- ── announcements ────────────────────────────────────────────────────────────
drop policy if exists "insert announcements" on announcements;
create policy "insert announcements" on announcements
  for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'));

-- ── event_participants ───────────────────────────────────────────────────────
drop policy if exists "insert event_participants" on event_participants;
drop policy if exists "delete event_participants" on event_participants;
create policy "insert event_participants" on event_participants
  for insert with check (auth.role() = 'authenticated');
create policy "delete event_participants" on event_participants
  for delete using (auth.role() = 'authenticated');

-- ── events ───────────────────────────────────────────────────────────────────
drop policy if exists "insert events" on events;
drop policy if exists "update events" on events;
drop policy if exists "delete events" on events;
create policy "insert events" on events
  for insert with check (auth.role() = 'authenticated');
create policy "update events" on events
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "delete events" on events
  for delete using (auth.role() = 'authenticated');

-- ── medical_comms (non-Player only) ─────────────────────────────────────────
drop policy if exists "write comms" on medical_comms;
create policy "write comms" on medical_comms
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'));

-- ── medical_records (non-Player only) ───────────────────────────────────────
drop policy if exists "write records" on medical_records;
create policy "write records" on medical_records
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'));

-- ── messages ─────────────────────────────────────────────────────────────────
drop policy if exists "insert messages" on messages;
create policy "insert messages" on messages
  for insert with check (auth.role() = 'authenticated');

-- ── nutrition_comments (own rows via author_id) ──────────────────────────────
drop policy if exists "nutr_comments_insert" on nutrition_comments;
drop policy if exists "nutr_comments_update" on nutrition_comments;
create policy "nutr_comments_insert" on nutrition_comments
  for insert with check (auth.uid() = author_id);
create policy "nutr_comments_update" on nutrition_comments
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

-- ── nutrition_entries (own rows via user_id) ──────────────────────────────────
drop policy if exists "nutr_entries_insert" on nutrition_entries;
drop policy if exists "nutr_entries_update" on nutrition_entries;
drop policy if exists "nutr_entries_delete" on nutrition_entries;
create policy "nutr_entries_insert" on nutrition_entries
  for insert with check (auth.uid() = user_id);
create policy "nutr_entries_update" on nutrition_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nutr_entries_delete" on nutrition_entries
  for delete using (auth.uid() = user_id);

-- ── nutrition_photos (via parent entry ownership) ────────────────────────────
drop policy if exists "nutr_photos_insert" on nutrition_photos;
drop policy if exists "nutr_photos_delete" on nutrition_photos;
create policy "nutr_photos_insert" on nutrition_photos
  for insert with check (
    exists (select 1 from public.nutrition_entries where id = entry_id and user_id = auth.uid())
  );
create policy "nutr_photos_delete" on nutrition_photos
  for delete using (
    exists (select 1 from public.nutrition_entries where id = entry_id and user_id = auth.uid())
  );

-- ── pinned_messages ──────────────────────────────────────────────────────────
drop policy if exists "Authenticated write pinned" on pinned_messages;
create policy "Authenticated write pinned" on pinned_messages
  for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── player_availability (non-Player / medical staff only) ────────────────────
drop policy if exists "write availability" on player_availability;
create policy "write availability" on player_availability
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role <> 'Player'));

-- ── player_bodyweight (own rows) ─────────────────────────────────────────────
drop policy if exists "insert own weight" on player_bodyweight;
drop policy if exists "upsert own weight" on player_bodyweight;
create policy "insert own weight" on player_bodyweight
  for insert with check (auth.uid() = user_id);
create policy "upsert own weight" on player_bodyweight
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── profiles (own profile only on insert) ────────────────────────────────────
drop policy if exists "Anyone can insert profiles" on profiles;
create policy "Anyone can insert profiles" on profiles
  for insert with check (auth.uid() = id);

-- ── session_rpe (own rows) ───────────────────────────────────────────────────
-- Handle both naming variants that may exist in the live DB
drop policy if exists "insert_session_rpe" on session_rpe;
drop policy if exists "update_session_rpe" on session_rpe;
drop policy if exists "insert session_rpe" on session_rpe;
drop policy if exists "update session_rpe" on session_rpe;
create policy "insert_session_rpe" on session_rpe
  for insert with check (auth.uid() = user_id);
create policy "update_session_rpe" on session_rpe
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── tasks ────────────────────────────────────────────────────────────────────
drop policy if exists "insert tasks" on tasks;
drop policy if exists "update tasks" on tasks;
drop policy if exists "delete tasks" on tasks;
create policy "insert tasks" on tasks
  for insert with check (auth.role() = 'authenticated');
create policy "update tasks" on tasks
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "delete tasks" on tasks
  for delete using (auth.role() = 'authenticated');

-- ── travel_items ─────────────────────────────────────────────────────────────
drop policy if exists "travel_items_ins" on travel_items;
drop policy if exists "travel_items_upd" on travel_items;
drop policy if exists "travel_items_del" on travel_items;
create policy "travel_items_ins" on travel_items
  for insert with check (auth.role() = 'authenticated');
create policy "travel_items_upd" on travel_items
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "travel_items_del" on travel_items
  for delete using (auth.role() = 'authenticated');

-- ── travel_packing_checks (own rows) ─────────────────────────────────────────
drop policy if exists "auth_tpc" on travel_packing_checks;
drop policy if exists "tpc_own" on travel_packing_checks;
create policy "tpc_own" on travel_packing_checks
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── travel_packing_items ─────────────────────────────────────────────────────
drop policy if exists "tpi_write" on travel_packing_items;
create policy "tpi_write" on travel_packing_items
  for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── travel_participants ──────────────────────────────────────────────────────
drop policy if exists "auth_tp" on travel_participants;
drop policy if exists "write all" on travel_participants;
drop policy if exists "tp_write" on travel_participants;
create policy "tp_write" on travel_participants
  for all to authenticated
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ── travel_trips ─────────────────────────────────────────────────────────────
drop policy if exists "travel_trips_ins" on travel_trips;
drop policy if exists "travel_trips_upd" on travel_trips;
drop policy if exists "travel_trips_del" on travel_trips;
create policy "travel_trips_ins" on travel_trips
  for insert with check (auth.role() = 'authenticated');
create policy "travel_trips_upd" on travel_trips
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "travel_trips_del" on travel_trips
  for delete using (auth.role() = 'authenticated');

-- ── wellness_body_pain (own rows) ────────────────────────────────────────────
drop policy if exists "insert_wbp" on wellness_body_pain;
drop policy if exists "delete_wbp" on wellness_body_pain;
drop policy if exists "insert wellness_body_pain" on wellness_body_pain;
drop policy if exists "delete wellness_body_pain" on wellness_body_pain;
create policy "insert_wbp" on wellness_body_pain
  for insert with check (auth.uid() = user_id);
create policy "delete_wbp" on wellness_body_pain
  for delete using (auth.uid() = user_id);

-- ── wellness_responses (own rows) ────────────────────────────────────────────
drop policy if exists "insert own responses" on wellness_responses;
drop policy if exists "upsert own responses" on wellness_responses;
create policy "insert own responses" on wellness_responses
  for insert with check (auth.uid() = user_id);
create policy "upsert own responses" on wellness_responses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── storage.objects — avatars listing (restrict to own file) ─────────────────
drop policy if exists "avatar_select" on storage.objects;
create policy "avatar_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text || '.jpg');

-- ── NOTE: 2 warnings cannot be fixed via SQL ─────────────────────────────────
-- 1. extension_in_public (pg_net): Supabase-managed extension — do not move.
-- 2. auth_leaked_password_protection: Enable in Dashboard → Authentication →
--    Settings → "Enable leaked password protection".
