# SPEC — Ticket #85: Movement label rename "Select an ingredient to continue" → "Select a RM# to continue"

## Source

`docs/tickets/85.md` — OpenProject Work Package #85 (Feature). Derived from #69, section MOVEMENT.

## Goal

Rename the helper text on the Movement product-picker screen from "Select an ingredient to continue" to "Select a RM# to continue" (RM# = raw material number).

## Acceptance criteria

1. The Movement product-picker screen (`/movements/new` with no `product` query param) shows the helper text **"Select a RM# to continue."** instead of "Select an ingredient to continue."
2. The string change is the only behavioral change; no other copy on that screen or elsewhere is altered by this ticket.

## Current state — IMPORTANT

The target string is **already present in the codebase**. As of the current branch (`ticket-84-catalog-archived-filter`), `apps/web/app/(app)/movements/new/page.tsx:32` reads:

```tsx
<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select a RM# to continue.</p>
```

The literal string "Select an ingredient to continue" does **not** appear anywhere in `apps/web/` source. It only appears in ticket markdown (`docs/tickets/85.md`, `docs/tickets/69.md`).

The ticket status is "In testing", consistent with the rename having already been made (the page also already has the RM#-only search behavior — see ticket #86, the sibling). The most likely history: ticket #69 ("Correction #2") and its derived tickets were partially implemented together; the Movement rename landed early.

**Therefore this ticket requires no code change.** It is a verification-only ticket. See "Verification protocol" below.

## Data model changes

None.

## API / route changes

None.

## UI changes

None required — the change is already in place at `apps/web/app/(app)/movements/new/page.tsx:32`.

## Files likely to touch

None. If verification finds the string somehow reverted, the only file to edit would be:

- `apps/web/app/(app)/movements/new/page.tsx` (line 32)

## In scope

- Confirming the Movement product-picker helper text reads "Select a RM# to continue."

## Out of scope

- **Reports page string.** `apps/web/app/(app)/reports/[slug]/page.tsx:132` contains a *different* string: `"Select an ingredient above and click Run."`. This is a separate screen and the ticket does not mention it. Flagged here so it is not silently changed. If the user wants Reports copy aligned to "RM#" terminology, that is a new ticket.
- The RM#-only search/filter behavior on the Movement screen — that is ticket **#86** ("Movement: filtrar/buscar únicamente por RM#"), already reflected in the same file (`ilike("sku", ...)`, `placeholder="Search by RM#…"`). Not part of #85.
- The other "ingredient" occurrences across the app (e.g. `NewIngredientForm`, audit page `<option>Ingredient</option>`, reports registry labels). Out of scope; ticket #85 targets one specific string only.

## Decisions made unilaterally

- **"RM#" capitalization/formatting:** the SPEC adopts the exact form from the ticket description — `RM#` (uppercase R, uppercase M, hash, no space) — and keeps the trailing period that the existing copy already uses ("Select a RM# to continue."). This matches the implemented line verbatim, so no change is needed.

## Institutional bites that apply

- None of the landmines section applies (no schema, no RLS, no migration, no types regeneration).
- "App Router only / server components by default" — the file is a server component; no `"use client"` change needed.
- CI cost discipline: run `pnpm lint` and `pnpm build` locally before any push, even for a no-op verification ticket, to confirm nothing else regressed.

## Verification protocol

Because no code change is expected, verification confirms the existing state:

1. `grep -rn "Select an ingredient to continue" apps/web/` — must return **no matches** in source.
2. Confirm `apps/web/app/(app)/movements/new/page.tsx:32` reads exactly `Select a RM# to continue.`.
3. `pnpm build` and `pnpm lint` — must pass (regression sanity).
4. Manual smoke check: navigate to `/movements/new` (no `?product=` param) and visually confirm the helper text under "Record movement" reads "Select a RM# to continue."
5. If the manual check passes, move the OpenProject ticket #85 to its done status (with user authorization).

If step 1 or 2 fails (string reverted), edit `apps/web/app/(app)/movements/new/page.tsx` line 32 to the target string, then repeat steps 3–4.

## No open questions

The string is unambiguous, found in exactly one source location, and already matches the requested text. No `85_OPEN_QUESTIONS.md` is needed.
