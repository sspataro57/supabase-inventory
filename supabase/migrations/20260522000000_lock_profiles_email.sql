-- Lock public.profiles.email: reconcile, make unique, make non-self-mutable
-- (OpenProject #93).
--
-- Context: #93 asked to make the "+ New User" flow on /users reachable. That
-- flow exists and works; the blocker is that a fresh deployment has no admin
-- and no in-app way to mint one. The first admin is bootstrapped out-of-band
-- by an operator running packages/db/scripts/bootstrap-admin.ts with the
-- service-role key -- a deliberate, identity-verified action. An automatic
-- email-keyed promotion (migration UPDATE or signup trigger) was rejected:
-- public email signup is open and unconfirmed, so anything that granted admin
-- by email could be claimed by an attacker who signs up with the owner's
-- address before the real owner does.
--
-- bootstrap-admin.ts promotes the profile whose email matches the owner
-- address. For that to be sound, profiles.email must faithfully mirror
-- auth.users.email (the true identity), be unique, and be non-forgeable.
-- The original profiles_update_self policy (20260506000010_rls.sql) pinned
-- only `role` in its WITH CHECK, so until now any user could rewrite their own
-- profiles.email to any address. This migration closes that in three steps,
-- in order:
--
--   1. RECONCILE -- repair profiles.email from auth.users.email so any row a
--      user previously rewrote is restored to its true identity. This must run
--      first: it also resolves any duplicate emails that prior tampering
--      created, so step 2 can succeed.
--   2. UNIQUE constraint -- profiles.email mirrors auth.users.email, which is
--      itself unique; the mirror simply never got the constraint. With it,
--      bootstrap-admin.ts (update ... where email = ...) matches exactly one
--      row. If duplicates somehow remain after step 1 this fails loudly.
--   3. Tighten profiles_update_self -- pin `email` in the WITH CHECK so users
--      can no longer mutate it. profiles.email has no legitimate self-service
--      update path, so this restricts no real user action (display_name etc.
--      remain editable).

-- Step 1: reconcile profiles.email to the auth.users source of truth.
update public.profiles p
   set email = u.email
  from auth.users u
 where p.id = u.id
   and u.email is not null
   and p.email is distinct from u.email;

-- Step 2: enforce uniqueness, mirroring auth.users.email.
alter table public.profiles
  add constraint profiles_email_key unique (email);

-- Step 3: prevent users from mutating their own profiles.email.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role  = (select role  from public.profiles where id = auth.uid())
    and email = (select email from public.profiles where id = auth.uid())
  );
