import { z } from "zod";

const today = () => new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export type ReportParam =
  | { type: "date"; name: string; label: string; default: string }
  | { type: "uuid"; name: string; label: string; default: null }
  | { type: "number"; name: string; label: string; default: number; min: number; max: number }
  | { type: "text"; name: string; label: string; default: string; optional: true };

export type ReportDef = {
  slug: string;
  name: string;
  description: string;
  isAdminOnly: boolean;
  params: ReportParam[];
  rpcName: string;
  columns: { key: string; label: string; numeric?: boolean; date?: boolean }[];
};

export const REPORTS: ReportDef[] = [
  {
    slug: "inventory-per-product",
    name: "Inventory by Product",
    description: "Current on-hand for every active product in display units, with reorder status.",
    isAdminOnly: false,
    params: [],
    rpcName: "report_inventory_per_product",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Product" },
      { key: "on_hand_display", label: "On Hand", numeric: true },
      { key: "display_unit", label: "Unit" },
      { key: "reorder_point_display", label: "Reorder At", numeric: true },
      { key: "reorder_qty_display", label: "Reorder Qty", numeric: true },
      { key: "is_low_stock", label: "Low Stock" },
      { key: "lot_count", label: "Lots", numeric: true },
    ],
  },
  {
    slug: "inventory-detailed",
    name: "Inventory — Lot Detail",
    description: "On-hand at lot level: lot code, expiration date, and quantity per lot.",
    isAdminOnly: false,
    params: [],
    rpcName: "report_inventory_detailed",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "product_name", label: "Product" },
      { key: "lot_code", label: "Lot" },
      { key: "expires_on", label: "Expires", date: true },
      { key: "is_expired", label: "Expired" },
      { key: "on_hand_display", label: "On Hand", numeric: true },
      { key: "display_unit", label: "Unit" },
    ],
  },
  {
    slug: "physical-count-sheet",
    name: "Physical Count Sheet",
    description: "Printable form with system quantities and blank columns for counted and variance.",
    isAdminOnly: false,
    params: [
      { type: "text", name: "p_name_filter", label: "Filter by name", default: "", optional: true },
    ],
    rpcName: "report_physical_count_sheet",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Product" },
      { key: "system_on_hand", label: "System Count", numeric: true },
      { key: "display_unit", label: "Unit" },
      { key: "_counted", label: "Counted" },
      { key: "_variance", label: "Variance" },
      { key: "_notes", label: "Notes" },
    ],
  },
  {
    slug: "movements-per-product",
    name: "Movement Ledger",
    description: "Full movement history for one product over a date range.",
    isAdminOnly: false,
    params: [
      { type: "uuid", name: "p_product_id", label: "Product", default: null },
      { type: "date", name: "p_from", label: "From", default: thirtyDaysAgo() },
      { type: "date", name: "p_to", label: "To", default: today() },
    ],
    rpcName: "report_movements_per_product",
    columns: [
      { key: "occurred_at", label: "Date", date: true },
      { key: "movement_type", label: "Type" },
      { key: "display_quantity", label: "Quantity", numeric: true },
      { key: "display_unit", label: "Unit" },
      { key: "lot_code", label: "Lot" },
      { key: "reason", label: "Reason" },
      { key: "performed_by", label: "By" },
    ],
  },
  {
    slug: "movements-summary",
    name: "Movements Summary",
    description: "Daily check-in/out totals across all products for a date range.",
    isAdminOnly: false,
    params: [
      { type: "date", name: "p_from", label: "From", default: thirtyDaysAgo() },
      { type: "date", name: "p_to", label: "To", default: today() },
    ],
    rpcName: "report_movements_summary",
    columns: [
      { key: "day", label: "Day", date: true },
      { key: "sku", label: "SKU" },
      { key: "product_name", label: "Product" },
      { key: "n_check_ins", label: "Check-ins", numeric: true },
      { key: "n_check_outs", label: "Check-outs", numeric: true },
      { key: "in_display", label: "In", numeric: true },
      { key: "out_display", label: "Out", numeric: true },
      { key: "net_display", label: "Net", numeric: true },
      { key: "display_unit", label: "Unit" },
    ],
  },
  {
    slug: "low-stock",
    name: "Low Stock",
    description: "Products at or below their reorder point with suggested order quantities.",
    isAdminOnly: false,
    params: [],
    rpcName: "report_low_stock",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Product" },
      { key: "on_hand_display", label: "On Hand", numeric: true },
      { key: "reorder_point_display", label: "Reorder At", numeric: true },
      { key: "shortage_display", label: "Shortage", numeric: true },
      { key: "suggested_order_display", label: "Suggested Order", numeric: true },
      { key: "display_unit", label: "Unit" },
    ],
  },
  {
    slug: "expiring-lots",
    name: "Expiring Lots",
    description: "Lots expiring within a given number of days.",
    isAdminOnly: false,
    params: [
      { type: "number", name: "p_days_ahead", label: "Days ahead", default: 30, min: 1, max: 365 },
    ],
    rpcName: "report_expiring_lots",
    columns: [
      { key: "expires_on", label: "Expires", date: true },
      { key: "days_until_expiry", label: "Days", numeric: true },
      { key: "is_expired", label: "Expired" },
      { key: "lot_code", label: "Lot" },
      { key: "sku", label: "SKU" },
      { key: "product_name", label: "Product" },
      { key: "on_hand_display", label: "On Hand", numeric: true },
      { key: "display_unit", label: "Unit" },
    ],
  },
  {
    slug: "dead-stock",
    name: "Dead Stock",
    description: "Products with no movement in N days. Candidates for write-down or disposal.",
    isAdminOnly: true,
    params: [
      { type: "number", name: "p_days_inactive", label: "Days inactive", default: 90, min: 1, max: 3650 },
    ],
    rpcName: "report_dead_stock",
    columns: [
      { key: "sku", label: "SKU" },
      { key: "name", label: "Product" },
      { key: "on_hand_display", label: "On Hand", numeric: true },
      { key: "display_unit", label: "Unit" },
      { key: "last_movement_at", label: "Last Movement", date: true },
      { key: "days_inactive", label: "Days Inactive", numeric: true },
    ],
  },
  {
    slug: "audit-trail",
    name: "Audit Trail",
    description: "Catalog, preference, and role changes for a date range.",
    isAdminOnly: true,
    params: [
      { type: "date", name: "p_from", label: "From", default: thirtyDaysAgo() },
      { type: "date", name: "p_to", label: "To", default: today() },
    ],
    rpcName: "report_audit_trail",
    columns: [
      { key: "occurred_at", label: "When", date: true },
      { key: "actor_email", label: "Actor" },
      { key: "action", label: "Action" },
      { key: "entity_type", label: "Entity" },
      { key: "entity_id", label: "ID" },
    ],
  },
];

export const paramsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));
export type ReportParams = z.infer<typeof paramsSchema>;

export function getReport(slug: string): ReportDef | undefined {
  return REPORTS.find((r) => r.slug === slug);
}
