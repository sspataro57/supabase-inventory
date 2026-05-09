-- Fix RLS recursion: is_admin() queries profiles, which triggers profiles RLS,
-- which calls is_admin() again. SECURITY DEFINER lets the inner query bypass RLS.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;
