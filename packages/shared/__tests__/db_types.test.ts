/**
 * OpenProject #92 — Locations & Sub-locations
 * OpenProject #91 — Reports: Inventory by Location
 *
 * Type-level tests against packages/shared/src/db.ts (the generated Supabase types).
 *
 * #92 checks:
 *  - AC#4 / AC#10: `lots.location` is NOT present in the generated types
 *  - AC#3 / AC#10: `products.sub_location_id` IS present in the generated types
 *  - AC#1 / AC#10: `locations` and `sub_locations` tables ARE present
 *
 * #91 checks (appended below):
 *  - After `pnpm db:types` is run with migration 20260521130000 applied,
 *    `db.ts` must contain:
 *      - A `report_inventory_by_location` entry in `Functions`.
 *      - A `report_inventory_by_location_row` entry in `CompositeTypes`.
 *      - The composite type contains all 8 documented columns.
 *
 * These tests MUST FAIL until:
 *  1. Migration `20260521120000_locations.sql` is applied locally (for #92 checks).
 *  2. Migration `20260521130000_report_inventory_by_location.sql` is applied (for #91 checks).
 *  3. `pnpm db:types` is run to regenerate `packages/shared/src/db.ts`.
 *
 * Run:  pnpm --filter @inventory/shared test
 *
 * Implementation note: we use runtime inspection of the generated `Database`
 * type shape by importing `db.ts` as a value (we read string keys at runtime).
 * This is necessary because TypeScript's compile-time `keyof` checks are not
 * available inside Vitest at runtime. Instead, we read `db.ts` as a text file
 * and search for the structural markers that the type generator emits.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Path to the generated DB types file
const DB_TYPES_PATH = join(__dirname, "../src/db.ts");

function readDbTypes(): string {
  return readFileSync(DB_TYPES_PATH, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenProject #92 checks (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

describe("Generated db.ts — lots table (AC#4 + AC#10)", () => {
  it("does NOT contain a `location` column in the lots Row type", () => {
    const content = readDbTypes();

    // The generator emits `location: string | null` inside the `lots` Row block.
    // We look for the pattern within the lots table block.
    // Simplest reliable check: the string "location:" must not appear inside the lots Row.
    //
    // Strategy: extract the lots Row block (between `lots: {` and the next `}`) and
    // confirm "location" is absent.
    //
    // Before migration + db:types: content still has `location: string | null`.
    // After migration + db:types: that line is absent.
    const lotsRowMatch = content.match(
      /lots:\s*\{[^}]*Row:\s*\{([^}]*)\}/s
    );

    if (!lotsRowMatch) {
      throw new Error(
        "Could not find `lots: { Row: { ... } }` block in db.ts. " +
        "Ensure `pnpm db:types` has been run after the migration."
      );
    }

    const lotsRowBlock = lotsRowMatch[1];
    // The `location` key must not appear in the Row block
    expect(lotsRowBlock).not.toMatch(/\blocation\b/);
  });
});

describe("Generated db.ts — products table (AC#3 + AC#10)", () => {
  it("contains a `sub_location_id` column in the products Row type", () => {
    const content = readDbTypes();

    const productsRowMatch = content.match(
      /products:\s*\{[^}]*Row:\s*\{([^}]*)\}/s
    );

    if (!productsRowMatch) {
      throw new Error(
        "Could not find `products: { Row: { ... } }` block in db.ts. " +
        "Ensure `pnpm db:types` has been run after the migration."
      );
    }

    const productsRowBlock = productsRowMatch[1];
    // sub_location_id must be present
    expect(productsRowBlock).toMatch(/\bsub_location_id\b/);
  });
});

describe("Generated db.ts — new tables (AC#1 + AC#10)", () => {
  it("contains a `locations` table definition", () => {
    const content = readDbTypes();
    // The generator emits `locations: { Row: { ... } }` for each table
    expect(content).toMatch(/\blocations\s*:\s*\{/);
  });

  it("contains a `sub_locations` table definition", () => {
    const content = readDbTypes();
    expect(content).toMatch(/\bsub_locations\s*:\s*\{/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OpenProject #91 — report_inventory_by_location type generation checks
//
// These tests FAIL until migration 20260521130000_report_inventory_by_location.sql
// is applied AND `pnpm db:types` is re-run.
// ─────────────────────────────────────────────────────────────────────────────

describe("Generated db.ts — report_inventory_by_location function (OpenProject #91)", () => {
  it("contains a `report_inventory_by_location` entry in the Functions section", () => {
    const content = readDbTypes();

    // The Supabase type generator emits an entry like:
    //   report_inventory_by_location: {
    //     Args: Record<PropertyKey, never>
    //     Returns: Database["public"]["CompositeTypes"]["report_inventory_by_location_row"][]
    //   }
    // inside the `Functions:` block.
    //
    // Before migration+regen: this string is absent → test fails.
    // After migration+regen: present → test passes.
    expect(
      content,
      'db.ts must contain "report_inventory_by_location" under Functions after pnpm db:types'
    ).toMatch(/\breport_inventory_by_location\s*:/);
  });

  it("the function's Returns type references the report_inventory_by_location_row composite type", () => {
    const content = readDbTypes();

    // The generator emits a Returns referencing the CompositeType.
    // We verify the function block specifically references the row type.
    const fnBlockMatch = content.match(
      /report_inventory_by_location\s*:\s*\{([^}]*)\}/s
    );

    if (!fnBlockMatch) {
      throw new Error(
        'Could not find "report_inventory_by_location: { ... }" block in db.ts. ' +
          "Apply migration 20260521130000 and run pnpm db:types."
      );
    }

    const fnBlock = fnBlockMatch[1];
    expect(fnBlock).toMatch(/report_inventory_by_location_row/);
  });
});

describe("Generated db.ts — report_inventory_by_location_row composite type (OpenProject #91)", () => {
  /** Extract the report_inventory_by_location_row CompositeType block from db.ts. */
  function extractRowBlock(content: string): string {
    // The generator emits the composite type in the CompositeTypes section.
    // Pattern:  report_inventory_by_location_row: {\n  col: type | null\n  ...\n}
    const match = content.match(
      /report_inventory_by_location_row\s*:\s*\{([^}]*)\}/s
    );
    if (!match) {
      throw new Error(
        'Could not find "report_inventory_by_location_row: { ... }" in db.ts. ' +
          "Apply migration 20260521130000 and run pnpm db:types."
      );
    }
    return match[1];
  }

  it("contains `location_code` column", () => {
    const block = extractRowBlock(readDbTypes());
    expect(block).toMatch(/\blocation_code\b/);
  });

  it("contains `room_name` column", () => {
    const block = extractRowBlock(readDbTypes());
    expect(block).toMatch(/\broom_name\b/);
  });

  it("contains `sub_location_code` column (nullable)", () => {
    const block = extractRowBlock(readDbTypes());
    expect(block).toMatch(/\bsub_location_code\b/);
  });

  it("contains `product_count` column", () => {
    const block = extractRowBlock(readDbTypes());
    expect(block).toMatch(/\bproduct_count\b/);
  });

  it("contains `lot_count` column", () => {
    const block = extractRowBlock(readDbTypes());
    expect(block).toMatch(/\blot_count\b/);
  });

  it("contains `on_hand_mass_oz` column", () => {
    const block = extractRowBlock(readDbTypes());
    expect(block).toMatch(/\bon_hand_mass_oz\b/);
  });

  it("contains `on_hand_volume_floz` column", () => {
    const block = extractRowBlock(readDbTypes());
    expect(block).toMatch(/\bon_hand_volume_floz\b/);
  });

  it("contains `on_hand_count_ea` column", () => {
    const block = extractRowBlock(readDbTypes());
    expect(block).toMatch(/\bon_hand_count_ea\b/);
  });
});
