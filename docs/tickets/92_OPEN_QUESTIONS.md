# Open Questions — Ticket #92 (RESOLVED)

All questions were answered on 2026-05-21. The SPEC at `docs/tickets/92_SPEC.md` has been locked. Decisions captured below for the record.

| # | Question | Decision |
|---|----------|----------|
| 1 | Room → prefix mapping | `DR` Dry Storage · `CO` Cooler · `FZ` Freezer · `WH` Warehouse · `3DC` 3-Door Cooler · `ULF` Ultra Low Freezer |
| 2 | `sub_locations.code` storage | Trigger (BEFORE INSERT OR UPDATE), not generated column |
| 3 | Sub-location creation flow | On-the-fly from the New Ingredient form. UI = Room dropdown + 3 free-text fields (shelf / level / spot). Server upserts the row if missing. |
| 4 | FK placement | On `products.sub_location_id`. One canonical location per ingredient. |
| 5 | Catalog filter semantics | Moot — single location per product means the filter is a direct predicate on `products.sub_location.location.code`. |
| 6 | Legacy `lots.location text` | DROPPED in the same migration. |
