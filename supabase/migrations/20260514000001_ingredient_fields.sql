-- New Ingredient form fields (ticket #68)
-- Additive only; existing product/lot/movement columns remain untouched so the
-- rest of the app (reports, dashboard, scan, movements, exports, etc.) keeps
-- working unchanged.

alter table products
  add column inventory_type        text,
  add column manufacturer          text,
  add column manufacturer_item_no  text,
  add column broker                text,
  add column broker_item_no        text,
  add column allergen              text,
  add column category              text;

alter table lots
  add column manufacture_date date,
  add column location         text;
