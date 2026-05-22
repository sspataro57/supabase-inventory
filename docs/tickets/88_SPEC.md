# SPEC — OpenProject #88: Remove placeholder text 'ljjl' from the chat input box

> **Provisional.** See `docs/tickets/88_OPEN_QUESTIONS.md`. The string `ljjl` is not present in the
> current codebase; the spec below covers the most likely end-state but the verification step depends
> on the answer to Q1.

## Source

`docs/tickets/88.md` — OpenProject Work Package #88, type Feature, derived from #69 ("Correction #2", CHAT section).

## Goal

Ensure the chat input box renders empty on initial load, with no leftover development placeholder string `'ljjl'`.

## Acceptance criteria

1. The chat input box (the text field in the chat composer) shows no pre-filled value `'ljjl'` on initial load. Quoting the ticket: "Borrar el texto 'ljjl' que aparece de inicio en el recuadro del chat".
2. The chat input box renders empty on a fresh `/chat/new` load — the `<input>`'s `value` is `""`.
3. The intentional placeholder attribute (`placeholder="Ask about inventory…"`, the greyed-out hint text) is preserved — it is a legitimate hint, not the test string to remove.
4. `/chat/new` and `/chat/[id]` both render the composer with an empty input on load.

## Investigation findings

- The chat input lives in `apps/web/components/ChatThread.tsx`. It is a controlled `<input>`:
  - `apps/web/components/ChatThread.tsx:36` — `const [input, setInput] = useState("");`
  - `apps/web/components/ChatThread.tsx:213-219` — `<input value={input} … placeholder="Ask about inventory…" />`
- A repo-wide, case-insensitive grep for `ljjl` returns **only** `docs/tickets/88.md`. The string does **not** appear in any `apps/web`, `packages/`, or `supabase/` source file.
- The current `ChatThread.tsx` already initializes `input` to `""` and uses a proper, intentional `placeholder` attribute. As-is, the component already satisfies acceptance criteria 1–4.
- Branch history: commit `6ca0159` is the most recent and the #69 work ("Correction #2") is already merged. The `ljjl` placeholder was most likely removed by an earlier commit on the #69 branch before this ticket was actioned.

## Decisions made unilaterally

None. The one open point is escalated to OPEN_QUESTIONS rather than guessed.

## Data model changes

None.

## API / route changes

None.

## UI changes

Depends on Q1:
- **If `ljjl` is already gone (most likely):** no code change. The ticket is verified as already-fixed; close with a note referencing the #69 commit that removed it.
- **If a stray `ljjl` is found** (e.g. an uncommitted local change, or a `defaultValue`/`value` literal in a not-yet-grepped surface): change the offending `useState("ljjl")` / `value="ljjl"` / `defaultValue="ljjl"` to an empty string `""` in `apps/web/components/ChatThread.tsx`. Server-component decision is unaffected — `ChatThread.tsx` is already a `"use client"` component.

## Files likely to touch

- `apps/web/components/ChatThread.tsx` — only if Q1 reveals a stray literal. Otherwise no file changes.

No migration, no Zod schema, no route handler is involved.

## In scope

- Confirming the chat input box renders empty on initial load.
- Removing the literal `'ljjl'` string if (and only if) it is actually present in a source file.

## Out of scope

- Any change to the `placeholder="Ask about inventory…"` hint text — that is intentional UX, not the test string.
- The empty-state copy / suggested prompts block (`SUGGESTED_PROMPTS`, lines 18-24, 141-163) — unrelated to this ticket.
- Streaming, conversation persistence, or any other chat behaviour.
- Other items derived from #69.

## Institutional bites that apply

- **Next.js conventions** — `ChatThread.tsx` is correctly a client component (`"use client"`); no server/client boundary change needed.
- **CI cost discipline** — run `pnpm lint` and `pnpm build` locally before pushing; do not WIP-push.
- **Commit message format** — `Short imperative summary (OpenProject #88)`; never add `Co-Authored-By: Claude`.
- No data-model bites apply (no migration, no `pnpm db:types`, no RLS).

## Verification protocol

1. Grep the repo for the string: `rg -i ljjl apps packages supabase` — expect zero matches in source. (Already true at spec time.)
2. `pnpm build` and `pnpm lint` at repo root — must pass.
3. Manual smoke check: log in, open `/chat/new`, confirm the input box is empty (cursor placeholder hint `Ask about inventory…` greyed out is fine, no real text).
4. Open an existing conversation `/chat/[id]` and confirm the composer input is likewise empty on load.
5. If no source change was required, record in the PR / ticket comment that the string was already absent (removed under #69) and the ticket is verified rather than re-fixed.

## Future work (out of this ticket)

None.
