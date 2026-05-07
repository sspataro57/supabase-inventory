-- ── Enable RLS on all tables ────────────────────────────────────────────────
alter table profiles    enable row level security;
alter table units       enable row level security;
alter table preferences enable row level security;
alter table products    enable row level security;
alter table product_codes enable row level security;
alter table lots        enable row level security;
alter table movements   enable row level security;
alter table audit_log   enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Users see their own row; admins see all
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_admin());
-- Only admin can change roles; users can update their own display_name
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy profiles_update_admin on profiles for update
  using (is_admin()) with check (is_admin());

-- ── units ───────────────────────────────────────────────────────────────────
create policy units_read on units for select using (auth.uid() is not null);
create policy units_write on units for all using (is_admin()) with check (is_admin());

-- ── preferences ─────────────────────────────────────────────────────────────
create policy preferences_read on preferences for select using (auth.uid() is not null);
create policy preferences_write on preferences for all using (is_admin()) with check (is_admin());

-- ── products ────────────────────────────────────────────────────────────────
create policy products_read on products for select using (auth.uid() is not null);
create policy products_write on products for all using (is_admin()) with check (is_admin());

-- ── product_codes ────────────────────────────────────────────────────────────
create policy product_codes_read on product_codes for select using (auth.uid() is not null);
create policy product_codes_write on product_codes for all using (is_admin()) with check (is_admin());

-- ── lots ────────────────────────────────────────────────────────────────────
create policy lots_read on lots for select using (auth.uid() is not null);
-- Users can create lots during check-in; admins have full access
create policy lots_insert_user on lots for insert
  with check (auth.uid() is not null);
create policy lots_update_admin on lots for update using (is_admin()) with check (is_admin());
create policy lots_delete_admin on lots for delete using (is_admin());

-- ── movements ───────────────────────────────────────────────────────────────
create policy movements_read on movements for select using (auth.uid() is not null);

create policy movements_insert_admin on movements for insert
  with check (is_admin());

create policy movements_insert_user_checkin on movements for insert
  with check (
    not is_admin()
    and movement_type = 'check_in'
    and exists (
      select 1 from products p
      where p.id = movements.product_id and p.user_can_check_in = true
    )
    and base_quantity > 0
    and performed_by = auth.uid()
  );

create policy movements_insert_user_checkout on movements for insert
  with check (
    not is_admin()
    and movement_type = 'check_out'
    and exists (
      select 1 from products p
      where p.id = movements.product_id and p.user_can_check_out = true
    )
    and base_quantity < 0
    and performed_by = auth.uid()
  );

-- Only admins can void movements
create policy movements_update_admin on movements for update using (is_admin()) with check (is_admin());

-- ── audit_log ────────────────────────────────────────────────────────────────
-- Users see their own actions; admins see all
create policy audit_log_read on audit_log for select
  using (actor_id = auth.uid() or is_admin());
-- Inserts done server-side only; no direct client inserts needed
create policy audit_log_insert on audit_log for insert
  with check (is_admin() or actor_id = auth.uid());
