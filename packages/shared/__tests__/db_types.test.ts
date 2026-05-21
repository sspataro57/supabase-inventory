/**
 * OpenProject #92 — Locations & Sub-locations
 * Type-level tests against packages/shared/src/db.ts (the generated Supabase types).
 *
 * These tests check the generated `Database` type to confirm that:
 *  - AC#4 / AC#10: `lots.location` is NOT present in the generated types
 *  - AC#3 / AC#10: `products.sub_location_id` IS present in the generated types
 *  - AC#1 / AC#10: `locations` and `sub_locations` tables ARE present
 *
 * These tests MUST FAIL until:
 *  1. Migration `20260521120000_locations.sql` is applied locally.
 *  2. `pnpm db:types` is run to regenerate `packages/shared/src/db.ts`.
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
