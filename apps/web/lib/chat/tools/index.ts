import { searchProductsTool } from "./search_products";
import { getProductTool } from "./get_product";
import { getStockTool } from "./get_stock";
import { getLotsTool } from "./get_lots";
import { listLowStockTool } from "./list_low_stock";
import { listExpiringLotsTool } from "./list_expiring_lots";
import { listMovementsTool } from "./list_movements";
import { convertUnitsTool } from "./convert_units";
import { getPreferencesTool } from "./get_preferences";
import type { ToolDef } from "@/lib/llm/provider";

export const ALL_TOOLS: ToolDef[] = [
  searchProductsTool,
  getProductTool,
  getStockTool,
  getLotsTool,
  listLowStockTool,
  listExpiringLotsTool,
  listMovementsTool,
  convertUnitsTool,
  getPreferencesTool,
];

export { searchProductsTool, getProductTool, getStockTool, getLotsTool,
  listLowStockTool, listExpiringLotsTool, listMovementsTool, convertUnitsTool, getPreferencesTool };
