/**
 * OpenProject #92 — Locations & Sub-locations
 * Unit tests for the Zod schemas that live in
 * packages/shared/src/schemas/locations.ts (file does not exist yet).
 *
 * These tests MUST FAIL until the implementation is in place.
 *
 * Run:  pnpm --filter @inventory/shared test
 */

import { describe, it, expect, beforeAll } from "vitest";

// ── schema handles ────────────────────────────────────────────────────────────
// Loaded lazily so individual tests fail with a useful assertion error rather
// than a single import-time crash that swallows all test names.

let SubLocationCodeSchema: { safeParse: (v: unknown) => { success: boolean } };
let ShelfSchema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } };
let LevelSchema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } };
let SpotSchema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } };
let NewIngredientFormSchema: { safeParse: (v: unknown) => { success: boolean } };

let schemasLoaded = false;
let schemasError: unknown = null;

beforeAll(async () => {
  try {
    const locMod = await import("../src/schemas/locations");
    SubLocationCodeSchema = locMod.SubLocationCodeSchema;
    ShelfSchema = locMod.ShelfSchema;
    LevelSchema = locMod.LevelSchema;
    SpotSchema = locMod.SpotSchema;
    const prodMod = await import("../src/schemas/products");
    NewIngredientFormSchema = prodMod.NewIngredientFormSchema;
    schemasLoaded = true;
  } catch (err) {
    schemasError = err;
  }
});

function assertLoaded(): void {
  if (!schemasLoaded) {
    throw new Error(
      `Schema modules not loaded — implement them first.\nUnderlying error: ${schemasError}`
    );
  }
}

// ─── SubLocationCodeSchema ────────────────────────────────────────────────────

describe("SubLocationCodeSchema", () => {
  it("accepts a well-formed code like DR-A-04-02", () => {
    assertLoaded();
    expect(SubLocationCodeSchema.safeParse("DR-A-04-02").success).toBe(true);
  });

  it("accepts codes with 1-to-4-char alphanumeric room prefix (e.g. 3DC-B-01-03)", () => {
    assertLoaded();
    expect(SubLocationCodeSchema.safeParse("3DC-B-01-03").success).toBe(true);
  });

  it("rejects lowercase room code dr-a-04-02", () => {
    assertLoaded();
    expect(SubLocationCodeSchema.safeParse("dr-a-04-02").success).toBe(false);
  });

  it("rejects single-digit level without zero-padding (DR-A-4-02)", () => {
    assertLoaded();
    expect(SubLocationCodeSchema.safeParse("DR-A-4-02").success).toBe(false);
  });

  it("rejects single-digit spot without zero-padding (DR-A-04-2)", () => {
    assertLoaded();
    expect(SubLocationCodeSchema.safeParse("DR-A-04-2").success).toBe(false);
  });

  it("rejects a room code longer than 4 characters (DRRRRR-A-04-02)", () => {
    assertLoaded();
    expect(SubLocationCodeSchema.safeParse("DRRRRR-A-04-02").success).toBe(false);
  });

  it("rejects missing shelf segment (DR-04-02)", () => {
    assertLoaded();
    expect(SubLocationCodeSchema.safeParse("DR-04-02").success).toBe(false);
  });
});

// ─── ShelfSchema ─────────────────────────────────────────────────────────────

describe("ShelfSchema", () => {
  it("accepts uppercase single letter A", () => {
    assertLoaded();
    const r = ShelfSchema.safeParse("A");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("A");
  });

  it("accepts lowercase input and transforms it to uppercase", () => {
    assertLoaded();
    const r = ShelfSchema.safeParse("a");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe("A");
  });

  it("accepts uppercase Z", () => {
    assertLoaded();
    expect(ShelfSchema.safeParse("Z").success).toBe(true);
  });

  it("rejects a digit (1 is not a shelf letter)", () => {
    assertLoaded();
    expect(ShelfSchema.safeParse("1").success).toBe(false);
  });

  it("rejects two letters (AB is not a single shelf letter)", () => {
    assertLoaded();
    expect(ShelfSchema.safeParse("AB").success).toBe(false);
  });

  it("rejects an empty string", () => {
    assertLoaded();
    expect(ShelfSchema.safeParse("").success).toBe(false);
  });
});

// ─── LevelSchema ─────────────────────────────────────────────────────────────

describe("LevelSchema", () => {
  it("accepts 1 (minimum)", () => {
    assertLoaded();
    expect(LevelSchema.safeParse(1).success).toBe(true);
  });

  it("accepts 99 (maximum)", () => {
    assertLoaded();
    expect(LevelSchema.safeParse(99).success).toBe(true);
  });

  it("accepts a numeric string that coerces to a valid value", () => {
    assertLoaded();
    const r = LevelSchema.safeParse("4");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(4);
  });

  it("rejects 0 (below minimum)", () => {
    assertLoaded();
    expect(LevelSchema.safeParse(0).success).toBe(false);
  });

  it("rejects 100 (above maximum)", () => {
    assertLoaded();
    expect(LevelSchema.safeParse(100).success).toBe(false);
  });

  it("rejects non-numeric string 'abc'", () => {
    assertLoaded();
    expect(LevelSchema.safeParse("abc").success).toBe(false);
  });
});

// ─── SpotSchema ──────────────────────────────────────────────────────────────

describe("SpotSchema", () => {
  it("accepts 1 (minimum)", () => {
    assertLoaded();
    expect(SpotSchema.safeParse(1).success).toBe(true);
  });

  it("accepts 99 (maximum)", () => {
    assertLoaded();
    expect(SpotSchema.safeParse(99).success).toBe(true);
  });

  it("accepts a numeric string that coerces to a valid value", () => {
    assertLoaded();
    const r = SpotSchema.safeParse("2");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(2);
  });

  it("rejects 0 (below minimum)", () => {
    assertLoaded();
    expect(SpotSchema.safeParse(0).success).toBe(false);
  });

  it("rejects 100 (above maximum)", () => {
    assertLoaded();
    expect(SpotSchema.safeParse(100).success).toBe(false);
  });

  it("rejects non-numeric string 'abc'", () => {
    assertLoaded();
    expect(SpotSchema.safeParse("abc").success).toBe(false);
  });
});

// ─── NewIngredientFormSchema — location fields ────────────────────────────────
// AC#6 + AC#11: the updated form schema must include room_id / shelf / level / spot
// and must NOT include the old `location` free-text field as a satisfying input.

describe("NewIngredientFormSchema — sub-location fields (AC#6 + AC#11)", () => {
  const validBase = {
    sku: "RM-001",
    name: "Test Ingredient",
    lot_code: "LOT-001",
    date_received: "2026-05-21",
    amount_received_oz: 100,
    room_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    shelf: "A",
    level: 4,
    spot: 2,
  };

  it("accepts a complete payload with room_id, shelf, level, and spot", () => {
    assertLoaded();
    expect(NewIngredientFormSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects when room_id is missing", () => {
    assertLoaded();
    const { room_id: _omit, ...payload } = validBase;
    expect(NewIngredientFormSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects when shelf is missing", () => {
    assertLoaded();
    const { shelf: _omit, ...payload } = validBase;
    expect(NewIngredientFormSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects when level is missing", () => {
    assertLoaded();
    const { level: _omit, ...payload } = validBase;
    expect(NewIngredientFormSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects when spot is missing", () => {
    assertLoaded();
    const { spot: _omit, ...payload } = validBase;
    expect(NewIngredientFormSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects when room_id is not a UUID", () => {
    assertLoaded();
    expect(
      NewIngredientFormSchema.safeParse({ ...validBase, room_id: "not-a-uuid" })
        .success
    ).toBe(false);
  });

  it("does NOT satisfy the new schema when only the legacy `location` text field is provided", () => {
    // The old `location` free-text field must not replace the new room_id requirement.
    assertLoaded();
    const legacyPayload = {
      sku: "RM-002",
      name: "Legacy Ingredient",
      lot_code: "LOT-002",
      date_received: "2026-05-21",
      amount_received_oz: 100,
      location: "Dry Storage", // old field — must not satisfy new schema
    };
    expect(NewIngredientFormSchema.safeParse(legacyPayload).success).toBe(false);
  });
});
