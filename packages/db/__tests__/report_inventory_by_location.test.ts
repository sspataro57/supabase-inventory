/**
 * OpenProject #91 — Reports: Inventory by Location
 * DB integration tests against the local Supabase instance (service-role client).
 *
 * These tests MUST FAIL until migration
 * `supabase/migrations/20260521130000_report_inventory_by_location.sql` is applied.
 *
 * Pre-requisites:
 *   - Local Supabase must be running (`pnpm supabase start`).
 *   - Migration `20260521120000_locations.sql` must already be applied (ticket #92).
 *   - The new migration `20260521130000_report_inventory_by_location.sql` must NOT yet
 *     be applied when running as red-phase. After `pnpm supabase db reset` with the
 *     new migration included all tests should turn green.
 *
 * Run:
 *   pnpm --filter @inventory/db test
 *
 * Cleanup contract:
 *   All fixture rows (movements, lots, products, sub_locations, test profiles) are
 *   deleted in afterAll. Sub-location codes are unique per test run via the random
 *   suffix in SKU prefix `RM-T91-<randomId>` — no collision risk on repeat runs.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "child_process";
import ws from "ws";

// ── Local Supabase credentials (standard local dev values — never production) ──
const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Postgres direct access (from `supabase status` — local dev only).
const PG_HOST = "127.0.0.1";
const PG_PORT = "5436";
const PG_USER = "postgres";
const PG_PASS = "postgres";
const PG_DB = "postgres";

// ── Unique run ID to avoid cross-run collisions ────────────────────────────────
const RUN_ID = Math.random().toString(36).slice(2, 8).toUpperCase();
const SKU_PREFIX = `RM-T91-${RUN_ID}`;

let db: SupabaseClient;

// ── Fixture state collected for cleanup ───────────────────────────────────────
const cleanupIds = {
  movementIds: [] as string[],
  lotIds: [] as string[],
  productIds: [] as string[],
  subLocationIds: [] as string[],
  testUserId: null as string | null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the row type we expect the RPC to return. */
type ReportRow = {
  location_code: string;
  room_name: string;
  sub_location_code: string | null;
  product_count: number;
  lot_count: number;
  on_hand_mass_oz: number;
  on_hand_volume_floz: number;
  on_hand_count_ea: number;
};

/** Call the RPC and return rows (or throw with a useful message on error). */
async function callRpc(): Promise<ReportRow[]> {
  const { data, error } = await db.rpc("report_inventory_by_location");
  if (error) {
    throw new Error(
      `RPC report_inventory_by_location failed: ${error.message} (code=${error.code}). ` +
        `Did you apply migration 20260521130000_report_inventory_by_location.sql?`
    );
  }
  return data as ReportRow[];
}

/** Insert a product, return its id. Registers for cleanup. */
async function insertProduct(overrides: {
  sku?: string;
  name?: string;
  measure_type?: "mass" | "volume" | "count";
  sub_location_id?: string | null;
}): Promise<string> {
  const sku = overrides.sku ?? `${SKU_PREFIX}-PROD-${Date.now()}`;
  const { data, error } = await db
    .from("products")
    .insert({
      sku,
      name: overrides.name ?? `Test Product ${sku}`,
      measure_type: overrides.measure_type ?? "mass",
      sub_location_id: overrides.sub_location_id ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertProduct failed: ${error.message}`);
  const id = (data as { id: string }).id;
  cleanupIds.productIds.push(id);
  return id;
}

/** Insert a lot for a product, return its id. Registers for cleanup. */
async function insertLot(productId: string, lotCode?: string): Promise<string> {
  const code = lotCode ?? `LOT-${RUN_ID}-${Date.now()}`;
  const { data, error } = await db
    .from("lots")
    .insert({ product_id: productId, lot_code: code })
    .select("id")
    .single();

  if (error) throw new Error(`insertLot failed: ${error.message}`);
  const id = (data as { id: string }).id;
  cleanupIds.lotIds.push(id);
  return id;
}

/**
 * Insert a movement. `base_quantity` is in base units (g, ml, or ea).
 * `performed_by` must be a valid profiles.id.
 * Registers for cleanup.
 */
async function insertMovement(opts: {
  productId: string;
  lotId?: string;
  baseQuantity: number;
  performedBy: string;
}): Promise<string> {
  const { data, error } = await db
    .from("movements")
    .insert({
      product_id: opts.productId,
      lot_id: opts.lotId ?? null,
      movement_type: "check_in",
      base_quantity: opts.baseQuantity,
      input_quantity: opts.baseQuantity,
      input_unit: "g", // unit reference; must exist in units table
      performed_by: opts.performedBy,
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertMovement failed: ${error.message}`);
  const id = (data as { id: string }).id;
  cleanupIds.movementIds.push(id);
  return id;
}

/**
 * Insert a sub_location in a given room (by room code). Returns its id.
 * Uses unique shelf/level/spot derived from run ID to avoid conflicts.
 */
async function insertSubLocation(
  roomCode: string,
  shelf: string,
  level: number,
  spot: number
): Promise<string> {
  const { data: loc, error: locErr } = await db
    .from("locations")
    .select("id")
    .eq("code", roomCode)
    .single();

  if (locErr || !loc)
    throw new Error(
      `Could not find location with code=${roomCode}: ${locErr?.message}`
    );

  const { data, error } = await db
    .from("sub_locations")
    .insert({
      location_id: (loc as { id: string }).id,
      shelf,
      level,
      spot,
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertSubLocation failed: ${error.message}`);
  const id = (data as { id: string }).id;
  cleanupIds.subLocationIds.push(id);
  return id;
}

/**
 * Run a SQL statement via psql using spawnSync (avoids shell-quoting issues).
 * Returns stdout as a trimmed string.
 */
function psql(sql: string): string {
  const result = spawnSync(
    "psql",
    [
      "-h", PG_HOST,
      "-p", PG_PORT,
      "-U", PG_USER,
      "-d", PG_DB,
      "-t",    // tuples only (no header/footer rows)
      "-A",    // unaligned output (no padding)
      "-c", sql,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: PG_PASS },
    }
  );

  if (result.error) throw new Error(`psql spawn failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`psql exited ${result.status}: ${result.stderr}`);
  }

  return result.stdout.trim();
}

/**
 * Create a throwaway auth.users + profiles row via direct psql.
 * The Supabase GoTrue admin API (`auth.admin.createUser`) fails on this local
 * instance with "Database error checking email" — known issue with the bundled
 * GoTrue version. We bypass it by inserting directly into `auth.users`.
 */
function createTestAuthUser(email: string): string {
  const sql =
    `INSERT INTO auth.users ` +
    `(id, email, encrypted_password, confirmed_at, role, aud, created_at, updated_at) ` +
    `VALUES (gen_random_uuid(), '${email}', '', now(), 'authenticated', 'authenticated', now(), now()) ` +
    `RETURNING id;`;

  const output = psql(sql);

  // psql -t -A returns just the value per row. With RETURNING the output is
  // the UUID on the first non-empty line.
  const uuidLine = output
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^[0-9a-f-]{36}$/.test(l));

  if (!uuidLine) {
    throw new Error(
      `createTestAuthUser: could not parse UUID from psql output: "${output}"`
    );
  }
  return uuidLine;
}

function deleteTestAuthUser(userId: string): void {
  psql(`DELETE FROM auth.users WHERE id = '${userId}';`);
}

// ── Test lifecycle ─────────────────────────────────────────────────────────────

beforeAll(async () => {
  db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  // Create a throwaway auth user + profile to satisfy movements.performed_by FK.
  const testEmail = `test-t91-${RUN_ID.toLowerCase()}@test.local`;
  const userId = createTestAuthUser(testEmail);

  if (!userId) throw new Error("createTestAuthUser returned empty id");

  // Insert profile row (profiles.id → auth.users.id FK)
  const { error: profileErr } = await db.from("profiles").upsert({
    id: userId,
    email: testEmail,
    role: "user",
  });
  if (profileErr && profileErr.code !== "23505") {
    // 23505 = duplicate key; profile may have been auto-inserted by trigger
    throw new Error(`Could not create test profile: ${profileErr.message}`);
  }

  cleanupIds.testUserId = userId;
}, 30_000);

afterAll(async () => {
  if (!db) return;

  // Delete in FK-dependency order: movements → lots → products → sub_locations → profile/user
  if (cleanupIds.movementIds.length) {
    await db.from("movements").delete().in("id", cleanupIds.movementIds);
  }
  if (cleanupIds.lotIds.length) {
    await db.from("lots").delete().in("id", cleanupIds.lotIds);
  }
  if (cleanupIds.productIds.length) {
    await db.from("products").delete().in("id", cleanupIds.productIds);
  }
  if (cleanupIds.subLocationIds.length) {
    await db.from("sub_locations").delete().in("id", cleanupIds.subLocationIds);
  }
  if (cleanupIds.testUserId) {
    await db.from("profiles").delete().eq("id", cleanupIds.testUserId);
    deleteTestAuthUser(cleanupIds.testUserId);
  }
}, 30_000);

// ═════════════════════════════════════════════════════════════════════════════
// AC#3 — column shape: RPC returns rows with all 8 documented columns
// ═════════════════════════════════════════════════════════════════════════════

describe("report_inventory_by_location — column shape (AC#3)", () => {
  it("RPC exists and returns rows with the 8 documented columns", async () => {
    // Before migration: RPC does not exist — callRpc() throws with a clear message.
    // After migration: returns at least the roll-up rows for the 6 seeded rooms.
    const rows = await callRpc();
    expect(rows.length).toBeGreaterThan(0);

    const first = rows[0];

    // All 8 columns must be present (even if null / zero for empty rooms)
    expect(first).toHaveProperty("location_code");
    expect(first).toHaveProperty("room_name");
    expect(first).toHaveProperty("sub_location_code"); // nullable — present as key
    expect(first).toHaveProperty("product_count");
    expect(first).toHaveProperty("lot_count");
    expect(first).toHaveProperty("on_hand_mass_oz");
    expect(first).toHaveProperty("on_hand_volume_floz");
    expect(first).toHaveProperty("on_hand_count_ea");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC#4 — empty rooms appear with zero counts (one roll-up row per room)
// ═════════════════════════════════════════════════════════════════════════════

describe("report_inventory_by_location — empty rooms (AC#4)", () => {
  it("all 6 seeded rooms appear in the result, each with a roll-up row where sub_location_code IS NULL", async () => {
    const rows = await callRpc();

    const expectedRoomCodes = ["DR", "CO", "FZ", "WH", "3DC", "ULF"];

    for (const code of expectedRoomCodes) {
      const rollupRow = rows.find(
        (r) => r.location_code === code && r.sub_location_code === null
      );
      expect(
        rollupRow,
        `Roll-up row for room code "${code}" must be present even when the room is empty`
      ).toBeDefined();
    }
  });

  it("a room with zero products yields product_count=0, lot_count=0, and all on-hand columns=0", async () => {
    const rows = await callRpc();

    // Find any roll-up row showing zero products (on a freshly reset local DB
    // at least some rooms will be empty)
    const emptyRollup = rows.find(
      (r) =>
        r.sub_location_code === null &&
        r.location_code !== "" &&
        r.product_count === 0
    );

    // The primary pre-migration failure is that callRpc() throws above.
    // If all rooms happen to have products, we note that but don't fail here.
    if (emptyRollup !== undefined) {
      expect(emptyRollup.lot_count).toBe(0);
      expect(Number(emptyRollup.on_hand_mass_oz)).toBe(0);
      expect(Number(emptyRollup.on_hand_volume_floz)).toBe(0);
      expect(Number(emptyRollup.on_hand_count_ea)).toBe(0);
    }

    // Unconditional: RPC must return rows
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC#3 / AC#2 — a product in DR shows in the DR roll-up row (product_count + 1)
// ═════════════════════════════════════════════════════════════════════════════

describe("report_inventory_by_location — product appears in room roll-up (AC#3)", () => {
  let slId: string;
  let prodId: string;

  afterAll(async () => {
    // Belt-and-suspenders cleanup (top-level afterAll also handles these IDs)
    if (prodId) await db.from("products").delete().eq("id", prodId);
    if (slId) await db.from("sub_locations").delete().eq("id", slId);
  });

  it("adding one product with a sub_location in DR increases the DR roll-up product_count by exactly 1", async () => {
    // Capture baseline DR roll-up count before inserting our product.
    // Before migration: callRpc() throws — that is the expected red-phase failure.
    const before = await callRpc();
    const drBefore = before.find(
      (r) => r.location_code === "DR" && r.sub_location_code === null
    );
    expect(drBefore, "DR roll-up row must exist before product insert").toBeDefined();
    const baselineCount = drBefore!.product_count;

    // Insert a sub_location in DR using level/spot values derived from RUN_ID
    // to avoid collisions with other test runs.
    const levelNum = (parseInt(RUN_ID.slice(0, 2), 36) % 90) + 1; // 1–90
    const spotNum = (parseInt(RUN_ID.slice(2, 4), 36) % 90) + 1; // 1–90
    slId = await insertSubLocation("DR", "T", levelNum, spotNum);

    // Insert a mass product assigned to this sub_location
    prodId = await insertProduct({
      sku: `${SKU_PREFIX}-MASS`,
      measure_type: "mass",
      sub_location_id: slId,
    });

    const after = await callRpc();
    const drAfter = after.find(
      (r) => r.location_code === "DR" && r.sub_location_code === null
    );
    expect(drAfter, "DR roll-up row must exist after product insert").toBeDefined();

    expect(drAfter!.product_count).toBe(baselineCount + 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC#3 — on_hand_mass_oz reflects a check_in movement (≈32 oz from 907.184 g)
// ═════════════════════════════════════════════════════════════════════════════

describe("report_inventory_by_location — on_hand_mass_oz from movement (AC#3)", () => {
  let slId: string;
  let prodId: string;
  let lotId: string | undefined;
  let movId: string;

  afterAll(async () => {
    if (movId) await db.from("movements").delete().eq("id", movId);
    if (lotId) await db.from("lots").delete().eq("id", lotId);
    if (prodId) await db.from("products").delete().eq("id", prodId);
    if (slId) await db.from("sub_locations").delete().eq("id", slId);
  });

  it("a check_in of 907.184 g on a mass product in DR surfaces as ≈32 oz delta in on_hand_mass_oz", async () => {
    const performedBy = cleanupIds.testUserId!;

    // 32 oz = 32 × 28.3495 g/oz = 907.184 g (base quantity stored)
    const OZ_FACTOR = 28.3495;
    const TARGET_OZ = 32;
    const BASE_GRAMS = TARGET_OZ * OZ_FACTOR; // 907.184

    // Use a level/spot offset of +1 from the product_count test to avoid collision
    const levelNum = (parseInt(RUN_ID.slice(0, 2), 36) % 90) + 1;
    const spotNum2 = ((parseInt(RUN_ID.slice(2, 4), 36) % 90) + 2) % 90 || 1;
    slId = await insertSubLocation("DR", "U", levelNum, spotNum2);

    prodId = await insertProduct({
      sku: `${SKU_PREFIX}-OZ`,
      measure_type: "mass",
      sub_location_id: slId,
    });

    // Respect the `require_lot_per_movement` preference (default false locally)
    const { data: prefs } = await db
      .from("preferences")
      .select("require_lot_per_movement")
      .eq("id", 1)
      .single();

    const requireLot =
      (prefs as { require_lot_per_movement: boolean } | null)
        ?.require_lot_per_movement ?? false;

    if (requireLot) {
      lotId = await insertLot(prodId, `LOT-OZ-${RUN_ID}`);
    }

    // Capture the DR baseline before our movement
    const before = await callRpc();
    const drBefore = before.find(
      (r) => r.location_code === "DR" && r.sub_location_code === null
    )!;
    const baselineMassOz = Number(drBefore.on_hand_mass_oz);

    movId = await insertMovement({
      productId: prodId,
      lotId,
      baseQuantity: BASE_GRAMS,
      performedBy,
    });

    const after = await callRpc();
    const drAfter = after.find(
      (r) => r.location_code === "DR" && r.sub_location_code === null
    )!;

    const delta = Number(drAfter.on_hand_mass_oz) - baselineMassOz;

    // Allow ±0.01 oz tolerance (the SQL rounds to 4 decimal places)
    expect(delta).toBeGreaterThan(TARGET_OZ - 0.01);
    expect(delta).toBeLessThan(TARGET_OZ + 0.01);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC#5 — products with sub_location_id IS NULL appear under "Unassigned"
// ═════════════════════════════════════════════════════════════════════════════

describe("report_inventory_by_location — Unassigned bucket (AC#5)", () => {
  let prodId: string;

  afterAll(async () => {
    if (prodId) await db.from("products").delete().eq("id", prodId);
  });

  it("a product with sub_location_id IS NULL appears under room_name='Unassigned' with location_code=''", async () => {
    // Capture Unassigned baseline product_count.
    // Before migration: callRpc() throws — that is the expected red-phase failure.
    const before = await callRpc();
    const unassignedBefore = before.find(
      (r) => r.room_name === "Unassigned" && r.sub_location_code === null
    );
    expect(
      unassignedBefore,
      "Unassigned roll-up row must be present before product insert"
    ).toBeDefined();
    const baselineCount = unassignedBefore!.product_count;

    // Insert a product with no sub_location_id (the Unassigned case)
    prodId = await insertProduct({
      sku: `${SKU_PREFIX}-UNASSIGNED`,
      measure_type: "count",
      sub_location_id: null,
    });

    const after = await callRpc();
    const unassignedAfter = after.find(
      (r) => r.room_name === "Unassigned" && r.sub_location_code === null
    );

    expect(
      unassignedAfter,
      "Unassigned roll-up row must still be present after insert"
    ).toBeDefined();
    expect(unassignedAfter!.location_code).toBe("");
    expect(unassignedAfter!.product_count).toBe(baselineCount + 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC#2 — result is ordered by sort_order asc; DR (10) before CO (20); Unassigned last
// ═════════════════════════════════════════════════════════════════════════════

describe("report_inventory_by_location — ordering (AC#2)", () => {
  it("DR roll-up row appears before CO roll-up row in the result (sort_order DR=10 < CO=20)", async () => {
    const rows = await callRpc();

    const drIndex = rows.findIndex(
      (r) => r.location_code === "DR" && r.sub_location_code === null
    );
    const coIndex = rows.findIndex(
      (r) => r.location_code === "CO" && r.sub_location_code === null
    );

    expect(drIndex, "DR roll-up row must be present").toBeGreaterThanOrEqual(0);
    expect(coIndex, "CO roll-up row must be present").toBeGreaterThanOrEqual(0);
    expect(drIndex, "DR must appear before CO in sort order").toBeLessThan(coIndex);
  });

  it("Unassigned row appears after all 6 seeded room rows (synthetic sort_order=1000000)", async () => {
    const rows = await callRpc();

    const unassignedIndex = rows.findIndex(
      (r) => r.room_name === "Unassigned" && r.sub_location_code === null
    );
    expect(
      unassignedIndex,
      "Unassigned roll-up row must be present"
    ).toBeGreaterThanOrEqual(0);

    const roomCodes = ["DR", "CO", "FZ", "WH", "3DC", "ULF"];
    for (const code of roomCodes) {
      const roomIndex = rows.findIndex(
        (r) => r.location_code === code && r.sub_location_code === null
      );
      if (roomIndex >= 0) {
        expect(
          roomIndex,
          `Room ${code} (roll-up) must appear before Unassigned`
        ).toBeLessThan(unassignedIndex);
      }
    }
  });
});
