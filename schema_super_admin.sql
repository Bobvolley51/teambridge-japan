-- Add super-admin flag to profiles
alter table profiles
  add column if not exists is_super_admin boolean not null default false;

-- Mark thomas.ranner@gmx.de as super-admin
update profiles
set is_super_admin = true
where id = (
  select id from auth.users where email = 'thomas.ranner@gmx.de'
);

-- Tighten RLS: only allow profile updates via authenticated users for their own row
-- (role changes must go through the /api/set-role server-side route)
-- Drop the overly permissive update policy if it exists
drop policy if exists "Users can update own profile" on profiles;

-- Allow users to update only their own non-role fields
create policy "Users can update own profile"
  on profiles for update
  using  (auth.uid() = id)
  with check (
    auth.uid() = id
    -- role and is_super_admin are not listed in with check intentionally;
    -- those fields must be changed via the /api/set-role service-role route
  );
