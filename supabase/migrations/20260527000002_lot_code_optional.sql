-- Make lots.lot_code optional (OpenProject #100).
-- Many samples arrive without a manufacturer-assigned lot number but still need
-- to be registered in inventory. The unique (product_id, lot_code) constraint
-- continues to prevent duplicate codes for a product; Postgres treats NULLs as
-- distinct, so multiple "no lot code" rows per product are allowed.

alter table lots alter column lot_code drop not null;
