/**
 * OpenProject #92 — Locations & Sub-locations
 * E2E acceptance tests for the UI surface of this feature.
 *
 * TODO: Playwright is NOT installed in this repo yet.
 *       To enable these tests:
 *         1. pnpm add -Dw -F web @playwright/test playwright
 *         2. npx playwright install --with-deps chromium
 *         3. Add a `playwright.config.ts` at apps/web/ (or repo root).
 *         4. Add a `test:e2e` script to apps/web/package.json.
 *         5. Remove the `describe.skip` wrappers below.
 *
 * Until Playwright is installed, every suite is wrapped in `describe.skip`
 * so `pnpm test` does not break the CI pipeline on a missing runner.
 *
 * These scenarios encode the following acceptance criteria:
 *   AC#6 — New Ingredient form has Room dropdown + 3 free-text fields
 *   AC#7 — Catalog detail shows sub-location code · room name in header
 *   AC#8 — Catalog list ?room=<code> filter
 *   AC#9 — Inventory Lot Detail report has Sub-Location and Room columns
 *
 * Manual verification steps (until Playwright is wired up):
 *   1. As admin, visit /products/new. Confirm the Room dropdown lists 6 rooms
 *      (DR · CO · FZ · WH · 3DC · ULF) and shows Shelf / Level / Spot fields.
 *   2. Submit with (Dry Storage, A, 4, 2). Visit /catalog/<new-id> and confirm
 *      the header shows "DR-A-04-02 · Dry Storage".
 *   3. Visit /catalog?room=DR — product is listed.
 *      Visit /catalog?room=CO — product is absent.
 *   4. Visit /reports/inventory-detailed — confirm "Sub-Location" and "Room"
 *      column headers are present.
 */

// The `describe` import comes from vitest when running in vitest context.
// In Playwright context it would come from @playwright/test.
// Using a lazy-import guard so this file doesn't crash the Vitest run when
// Playwright is absent.

import { describe, it, expect } from "vitest";

// ─── AC#6 — /products/new: Room dropdown + 3 free-text fields ────────────────

describe.skip("TODO (Playwright not installed) — /products/new form (AC#6)", () => {
  it("shows a Room <select> with exactly 6 options", async () => {
    // Playwright: await page.goto("http://localhost:3000/products/new");
    // const options = await page.locator('select[name="room_id"] option').all();
    // expect(options).toHaveLength(6); // + 1 if a placeholder option is added
    throw new Error("Not implemented — requires Playwright");
  });

  it("shows a Shelf text input, Level number input, and Spot number input", async () => {
    // Playwright:
    // await expect(page.locator('input[name="shelf"]')).toBeVisible();
    // await expect(page.locator('input[name="level"]')).toBeVisible();
    // await expect(page.locator('input[name="spot"]')).toBeVisible();
    throw new Error("Not implemented — requires Playwright");
  });
});

// ─── AC#6+AC#7 — Form submit → sub-location created → detail shows code ──────

describe.skip("TODO (Playwright not installed) — New Ingredient → Catalog detail (AC#6+AC#7)", () => {
  it("submitting with (Dry Storage, A, 4, 2) creates a product whose detail page shows DR-A-04-02 · Dry Storage", async () => {
    // Playwright:
    // await page.goto("http://localhost:3000/products/new");
    // await page.selectOption('select[name="room_id"]', { label: "Dry Storage" });
    // await page.fill('input[name="shelf"]', "A");
    // await page.fill('input[name="level"]', "4");
    // await page.fill('input[name="spot"]', "2");
    // await page.fill('input[name="sku"]', "RM-TEST-92");
    // await page.fill('input[name="name"]', "E2E Test Ingredient");
    // await page.fill('input[name="lot_code"]', "LOT-TEST");
    // await page.fill('input[name="date_received"]', "2026-05-21");
    // await page.fill('input[name="amount_received_oz"]', "100");
    // await page.click('button[type="submit"]');
    // await page.waitForURL(/\/catalog\//);
    // await expect(page.getByText("DR-A-04-02")).toBeVisible();
    // await expect(page.getByText("Dry Storage")).toBeVisible();
    throw new Error("Not implemented — requires Playwright");
  });
});

// ─── AC#8 — Catalog list ?room= filter ───────────────────────────────────────

describe.skip("TODO (Playwright not installed) — Catalog list room filter (AC#8)", () => {
  it("shows the product when ?room=DR is applied", async () => {
    // Playwright:
    // await page.goto("http://localhost:3000/catalog?room=DR");
    // await expect(page.getByText("E2E Test Ingredient")).toBeVisible();
    throw new Error("Not implemented — requires Playwright");
  });

  it("hides the product when ?room=CO is applied", async () => {
    // Playwright:
    // await page.goto("http://localhost:3000/catalog?room=CO");
    // await expect(page.getByText("E2E Test Ingredient")).not.toBeVisible();
    throw new Error("Not implemented — requires Playwright");
  });
});

// ─── AC#9 — Inventory Lot Detail report has Sub-Location and Room columns ─────

describe.skip("TODO (Playwright not installed) — Inventory Lot Detail report columns (AC#9)", () => {
  it("has a Sub-Location column header in the inventory-detailed report table", async () => {
    // Playwright:
    // await page.goto("http://localhost:3000/reports/inventory-detailed");
    // await expect(page.getByRole("columnheader", { name: "Sub-Location" })).toBeVisible();
    throw new Error("Not implemented — requires Playwright");
  });

  it("has a Room column header in the inventory-detailed report table", async () => {
    // Playwright:
    // await expect(page.getByRole("columnheader", { name: "Room" })).toBeVisible();
    throw new Error("Not implemented — requires Playwright");
  });
});
