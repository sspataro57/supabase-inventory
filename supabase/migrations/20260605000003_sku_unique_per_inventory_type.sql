-- #146: The same RM# (sku) must be allowed once per Inventory Type.
--
-- An ingredient can legitimately exist as both "RM Commercial" and
-- "RM Non-Commercial" with the same RM# — same physical item, different use in
-- the company. The original single-column UNIQUE on products.sku blocked that.
--
-- Replace it with a composite uniqueness over (sku, inventory_type). We use a
-- functional unique index on coalesce(inventory_type, '') so that NULL inventory
-- types still collide on duplicate sku (treated as the empty bucket), which
-- keeps non-ingredient products created via the generic product form unique by
-- sku. This avoids relying on NULLS NOT DISTINCT for portability.
alter table products drop constraint products_sku_key;

create unique index products_sku_inventory_type_key
  on products (sku, coalesce(inventory_type, ''));
