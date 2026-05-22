# Ticket #89 — QA Results

Functional smoke test of every report, run 2026-05-21 at the SQL (RPC) level
against a local Supabase seeded with representative data: products of all
three measure types (mass / volume / count), sub-locations, expiring and
expired lots, a `void` movement, an archived product, an idle (100-day)
product, and audit-log entries.

## Reports tested

| # | Slug | RPC | Result |
|---|------|-----|--------|
| 1 | `inventory-per-product` | `report_inventory_per_product()` | PASS — low-stock flag correct |
| 2 | `inventory-detailed` | `report_inventory_detailed()` | PASS with finding — see below |
| 3 | `physical-count-sheet` | `report_physical_count_sheet()` | PASS |
| 4 | `movements-per-product` | `report_movements_per_product()` | PASS |
| 5 | `movements-summary` | `report_movements_summary()` | PASS — daily in/out/net correct |
| 6 | `low-stock` | `report_low_stock()` | PASS — shortage math correct |
| 7 | `expiring-lots` | `report_expiring_lots()` | PASS — excludes zero-on-hand expired lot |
| 8 | `dead-stock` (admin) | `report_dead_stock()` | PASS — 100-day-idle product surfaced |
| 9 | `audit-trail` / "Change Log" (admin) | `report_audit_trail()` | PASS |
| 10 | `inventory-by-location` | `report_inventory_by_location()` | PASS — empty rooms + Unassigned bucket |

Cross-cutting checks: `void` movements are excluded from every report;
archived products are excluded; admin-only reports (`dead-stock`,
`audit-trail`) raise `forbidden` for non-admins and return data for admins.

## Findings filed as separate tickets

- **OpenProject #95** (Bug) — `report_inventory_detailed.is_expired` returns
  `NULL` (renders as a blank cell) for lots with no `expires_on`, instead of
  `false`. Minor / cosmetic plus a type-safety inconsistency. Related to #89.

No other defects found.

## Notes

- This was an automated SQL-level pass. It confirms each report runs without
  error and returns sensible aggregates; it does not cover browser rendering,
  CSV/PDF export, or UX clarity. A human walkthrough remains valuable for
  those surfaces.
