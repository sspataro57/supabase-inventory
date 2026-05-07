-- Storage bucket for CSV imports/results (admin-only)
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

-- Only admins can upload and download
create policy "admins can upload imports"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'imports'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "admins can read imports"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'imports'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
