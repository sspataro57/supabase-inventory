export type ReportInventoryPerProductRow = {
  product_id: string;
  sku: string;
  name: string;
  display_unit: string;
  on_hand_display: number;
  reorder_point_display: number | null;
  reorder_qty_display: number | null;
  is_low_stock: boolean;
  lot_count: number;
};

export type ReportInventoryDetailedRow = {
  product_id: string;
  sku: string;
  product_name: string;
  lot_id: string;
  lot_code: string;
  expires_on: string | null;
  is_expired: boolean;
  on_hand_display: number;
  display_unit: string;
  sub_location_code: string;
  room_name: string;
};

export type ReportPhysicalCountSheetRow = {
  sku: string;
  name: string;
  display_unit: string;
  system_on_hand: number;
};

export type ReportMovementsPerProductRow = {
  movement_id: string;
  occurred_at: string;
  movement_type: string;
  input_quantity: number;
  input_unit: string;
  display_quantity: number;
  display_unit: string;
  reason: string | null;
  lot_code: string | null;
  performed_by: string | null;
};

export type ReportMovementsSummaryRow = {
  day: string;
  product_id: string;
  sku: string;
  product_name: string;
  display_unit: string;
  n_check_ins: number;
  n_check_outs: number;
  in_display: number;
  out_display: number;
  net_display: number;
};

export type ReportLowStockRow = {
  product_id: string;
  sku: string;
  name: string;
  display_unit: string;
  on_hand_display: number;
  reorder_point_display: number;
  shortage_display: number;
  suggested_order_display: number;
};

export type ReportExpiringLotsRow = {
  lot_id: string;
  lot_code: string;
  product_id: string;
  sku: string;
  product_name: string;
  expires_on: string;
  days_until_expiry: number;
  is_expired: boolean;
  on_hand_display: number;
  display_unit: string;
};

export type ReportDeadStockRow = {
  product_id: string;
  sku: string;
  name: string;
  display_unit: string;
  on_hand_display: number;
  last_movement_at: string | null;
  days_inactive: number | null;
};

export type ReportAuditTrailRow = {
  occurred_at: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
};

export type AnyReportRow =
  | ReportInventoryPerProductRow
  | ReportInventoryDetailedRow
  | ReportPhysicalCountSheetRow
  | ReportMovementsPerProductRow
  | ReportMovementsSummaryRow
  | ReportLowStockRow
  | ReportExpiringLotsRow
  | ReportDeadStockRow
  | ReportAuditTrailRow;
