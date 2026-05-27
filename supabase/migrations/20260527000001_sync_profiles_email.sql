-- Sync public.profiles.email when auth.users.email changes (OpenProject #96).
--
-- Background: handle_new_user() (20260506000011_profile_signup_trigger.sql)
-- populates profiles.email once at signup. 20260522000000_lock_profiles_email.sql
-- made the column unique and removed self-service mutation. That leaves a gap:
-- if a user's Auth email is later changed (e.g. via GoTrue's email-change flow),
-- the mirror in profiles.email goes stale and bootstrap-admin.ts -- which keys
-- off profiles.email -- would match the wrong row or no row at all.
--
-- Fix: an AFTER UPDATE OF email trigger on auth.users that propagates the new
-- address into profiles. SECURITY DEFINER because profiles_update_self forbids
-- email mutation from any non-superuser path.

create or replace function handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update profiles
       set email = new.email
     where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function handle_user_email_change();
