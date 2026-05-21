/**
 * OpenProject #92 — Locations & Sub-locations
 * DB integration tests against the local Supabase instance (service-role client).
 *
 * These tests MUST FAIL until migration `20260521120000_locations.sql` is applied.
 *
 * Pre-requisites:
 *   - Local Supabase must be running (`pnpm supabase start`).
 *   - The migration must NOT yet be applied (tests are red-phase).
 *   - After `pnpm supabase db reset` with the new migration included, all tests
 *     should turn green.
 *
 * Run:
 *   pnpm --filter @inventory/db test
 *
 * NOTE on lots.location (AC#4):
 *   The local DB does not currently have lots.location either (migration
 *   20260514000001 was never applied to this local instance).  The correct
 *   test for AC#4 is therefore a type-level check: after `pnpm db:types`,
 *   packages/shared/src/db.ts must NOT contain a `location` property in the
 *   `lots` Row type.  That check lives in `packages/shared/__tests__/db_types.test.ts`.
 *   The integration test below exercises the behaviours that are only possible
 *   once the migration is applied (new tables, trigger, FK).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";

// Local Supabase credentials (from `supabase status`).
// These are the standard local dev values — never production.
const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

let adminClient: SupabaseClient;
let anonClient: SupabaseClient;

beforeAll(() => {
  // Node 20 lacks native WebSocket — supply the `ws` package
  adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
  anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
});

// ─── AC#1 — locations table seeded with exactly 6 rows ───────────────────────

describe("locations table — seed data (AC#1)", () => {
  it("has exactly 6 rows after migration", async () => {
    const { count, error } = await adminClient
      .from("locations")
      .select("*", { count: "exact", head: true });

    // Before migration: error code 42P01 ("relation does not exist").
    // After migration: error is null and count is 6.
    expect(error).toBeNull();
    expect(count).toBe(6);
  });

  it("contains all six expected room codes in any order", async () => {
    const { data, error } = await adminClient
      .from("locations")
      .select("code")
      .order("code");

    expect(error).toBeNull();
    const codes = (data ?? []).map((r: { code: string }) => r.code).sort();
    expect(codes).toEqual(["3DC", "CO", "DR", "FZ", "ULF", "WH"]);
  });
});

// ─── AC#2 — sub_locations trigger: code is computed correctly ─────────────────

describe("sub_locations trigger — code generation (AC#2)", () => {
  it("upcases shelf and zero-pads level/spot into the correct code format (DR-A-04-02)", async () => {
    const { data: loc, error: locErr } = await adminClient
      .from("locations")
      .select("id")
      .eq("code", "DR")
      .single();

    expect(locErr).toBeNull();
    const drId = (loc as { id: string }).id;

    // Insert with lowercase shelf so trigger uppercasing is exercised
    const { data: row, error } = await adminClient
      .from("sub_locations")
      .insert({ location_id: drId, shelf: "a", level: 4, spot: 2 })
      .select("code, shelf")
      .single();

    expect(error).toBeNull();
    expect((row as { code: string }).code).toBe("DR-A-04-02");
    expect((row as { shelf: string }).shelf).toBe("A");

    // Cleanup — remove test row so subsequent runs stay idempotent
    await adminClient
      .from("sub_locations")
      .delete()
      .eq("code", "DR-A-04-02");
  });

  it("rejects level=100 with sub_locations_level_range constraint violation", async () => {
    const { data: loc } = await adminClient
      .from("locations")
      .select("id")
      .eq("code", "DR")
      .single();

    const { error } = await adminClient
      .from("sub_locations")
      .insert({
        location_id: (loc as { id: string }).id,
        shelf: "A",
        level: 100,
        spot: 1,
      })
      .select("id")
      .single();

    expect(error).not.toBeNull();
    // The Postgres check constraint name must appear in the PostgREST error message
    expect(error!.message).toMatch(/sub_locations_level_range/);
  });

  it("rejects duplicate (location_id, shelf, level, spot) with unique constraint (code 23505)", async () => {
    const { data: loc } = await adminClient
      .from("locations")
      .select("id")
      .eq("code", "CO")
      .single();

    const locationId = (loc as { id: string }).id;
    const payload = { location_id: locationId, shelf: "B", level: 3, spot: 5 };

    // First insert must succeed
    const { error: firstErr } = await adminClient
      .from("sub_locations")
      .insert(payload);
    expect(firstErr).toBeNull();

    // Second insert with the same composite key must fail
    const { error: secondErr } = await adminClient
      .from("sub_locations")
      .insert(payload);
    expect(secondErr).not.toBeNull();
    expect(secondErr!.code).toBe("23505");

    // Cleanup
    await adminClient
      .from("sub_locations")
      .delete()
      .eq("location_id", locationId)
      .eq("shelf", "B")
      .eq("level", 3)
      .eq("spot", 5);
  });
});

// ─── AC#3 — products.sub_location_id FK column exists and works ──────────────

describe("products.sub_location_id column (AC#3)", () => {
  it("accepts a valid sub_location_id FK on a new product", async () => {
    // Create a sub_location to reference
    const { data: loc } = await adminClient
      .from("locations")
      .select("id")
      .eq("code", "FZ")
      .single();

    const { data: sl, error: slErr } = await adminClient
      .from("sub_locations")
      .insert({
        location_id: (loc as { id: string }).id,
        shelf: "Z",
        level: 9,
        spot: 9,
      })
      .select("id")
      .single();

    expect(slErr).toBeNull();
    const slId = (sl as { id: string }).id;

    // Create a throwaway product with sub_location_id set
    const { data: prod, error: prodErr } = await adminClient
      .from("products")
      .insert({
        sku: "__test_92_fk__",
        name: "__Test Product for #92 FK__",
        measure_type: "count",
        sub_location_id: slId,
      })
      .select("id, sub_location_id")
      .single();

    expect(prodErr).toBeNull();
    expect((prod as { sub_location_id: string }).sub_location_id).toBe(slId);

    // Cleanup
    await adminClient.from("products").delete().eq("id", (prod as { id: string }).id);
    await adminClient.from("sub_locations").delete().eq("id", slId);
  });

  it("allows products.sub_location_id to be null (nullable FK — existing rows survive)", async () => {
    // Create a product without a sub_location_id — must succeed (nullable FK)
    const { data: prod, error } = await adminClient
      .from("products")
      .insert({
        sku: "__test_92_null_fk__",
        name: "__Test Product for #92 null FK__",
        measure_type: "count",
        // sub_location_id intentionally omitted
      })
      .select("id, sub_location_id")
      .single();

    // Before migration, this will fail because sub_location_id column doesn't exist
    // and PostgREST will return an error for an unexpected column name.
    // Actually before migration it will succeed but return null for sub_location_id
    // since the column doesn't exist yet — PostgREST just ignores unknown insert cols.
    // The key assertion is that after migration the column exists and is null here.
    expect(error).toBeNull();
    expect((prod as { sub_location_id: string | null }).sub_location_id).toBeNull();

    await adminClient.from("products").delete().eq("id", (prod as { id: string }).id);
  });
});

// ─── AC#5 — RLS: non-admin cannot write to locations table ───────────────────

describe("RLS on locations table (AC#5)", () => {
  it("blocks INSERT on locations for the anon role (table must exist for RLS to apply)", async () => {
    // Before migration: table doesn't exist → PostgREST returns an error with
    //   code "42P01" (relation does not exist).  The test still fails because
    //   we assert the error message specifically says RLS or the table is missing
    //   AND because the locations table does not exist — which is the pre-migration state.
    //
    // After migration: RLS policy `locations_write` uses `is_admin()` for writes.
    //   An anon-role insert must be rejected with an RLS violation.
    //
    // Either way the insert must be rejected.

    const { error } = await anonClient
      .from("locations")
      .insert({ code: "TST", name: "Test Room (should be rejected)" });

    expect(error).not.toBeNull();

    // After migration the error code must be an RLS violation (not a missing-table error)
    const isRlsViolation =
      error!.code === "42501" ||
      (error as { status?: number }).status === 403 ||
      /violates row-level security|permission denied/i.test(error!.message ?? "");

    const isTableMissing = error!.code === "42P01";

    // Currently: table is missing → isTableMissing is true → test fails on isRlsViolation.
    // After migration: RLS rejects → isRlsViolation is true → test passes.
    expect(isRlsViolation).toBe(true);

    if (isTableMissing) {
      // Emit a clear diagnostic so the implementer knows why this is failing
      throw new Error(
        `Expected an RLS violation (code 42501 or HTTP 403) but got code=${error!.code}: "${error!.message}". ` +
        `This means the migration has not been applied yet — the locations table does not exist.`
      );
    }
  });
});
