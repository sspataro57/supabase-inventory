# Ticket #87 — SPEC

## Source
`docs/tickets/87.md` — "Chat: documentar cómo se utiliza la función (palabras clave/comandos)". Derived from #69 (CHAT section).

## Goal
Add a short, plain-language "how to use" blurb to the chat empty state so users understand the chat is a free-form natural-language assistant requiring no keywords or commands.

## Factual basis
The chat is a natural-language LLM assistant backed by 9 read-only inventory tools (`apps/web/lib/chat/tools/index.ts`): `search_products`, `get_product`, `get_stock`, `get_lots`, `list_low_stock`, `list_expiring_lots`, `list_movements`, `convert_units`, `get_preferences`. No keywords or commands are required — the system prompt (`apps/web/lib/chat/system-prompt.ts`) drives tool calls from plain questions. The chat is read-only (cannot modify inventory). It can answer about stock levels, low-stock items, expiring lots, lot details, recent movements, default units, and unit conversions.

## Acceptance criteria
1. The chat empty state (the block rendered when `messages.length === 0` in `ChatThread.tsx`) shows a 2-3 sentence "How to use this" blurb in addition to the existing "Ask anything about your inventory." line.
2. The blurb states explicitly that no special commands or keywords are needed — the user just asks questions in plain language.
3. The blurb names the topics the chat can cover (stock, low-stock items, expiring lots, lot details, recent movements, default units, unit conversions).
4. The existing `SUGGESTED_PROMPTS` chips and the "Ask anything about your inventory." line are kept (augmented, not replaced).
5. The blurb is styled as muted helper text consistent with the existing empty-state styling, and disappears once a conversation starts (same as the suggested prompts today).
6. `pnpm build` and `pnpm lint` pass.

## Data model changes
None.

## API / route changes
None.

## UI changes
Single file: `apps/web/components/ChatThread.tsx`. Inside the existing `messages.length === 0` block (lines 141-156), insert a help paragraph below the "Ask anything about your inventory." line and above the suggested-prompt chips. Pure JSX text inside the existing client component — no new component, no new props.

### Exact copy for the blurb
> No commands or keywords needed — just ask in plain language, the way you would ask a colleague. The assistant can tell you current stock levels, which items are low or running out, lots that are expiring soon, lot details, recent movements, your default units, and unit conversions. It can read your inventory but cannot make changes.

Suggested placement/styling (muted, matching the existing `text-gray-400 dark:text-gray-500` empty-state text), e.g. a `<p>` with `text-xs` and `max-w-md mx-auto` so it reads comfortably above the chips. Final classNames at implementer discretion as long as it matches the muted empty-state look.

### Persistent help affordance — decision
Not added. Empty-state only. The suggested prompts already vanish once a conversation starts; a persistent "?" affordance is out of scope and not warranted for this ticket.

## Decisions made unilaterally
- Pure UI text change in `ChatThread.tsx`; no backend, schema, or new component.
- English copy only — the app has no i18n (`Grep` for `i18n`/`español`/`language` in `apps/web/lib/chat` returned nothing). The ticket is in Spanish but is a documentation request from the client, not a request to localize the UI.
- The reports `helpText` registry pattern (`apps/web/lib/reports/registry.ts`, ticket #90) was considered. The chat has no equivalent registry and only one help string is needed, so inlining the copy in the empty state is simpler and matches the existing inline `SUGGESTED_PROMPTS` constant. No registry/config indirection added.
- Spanish capability of the LLM: the system prompt (`apps/web/lib/chat/system-prompt.ts`) contains no language instruction, so the model answers in whatever language the user writes by default but this is not explicitly enforced. The blurb deliberately does not promise Spanish support. See "Future work" — if guaranteed Spanish replies are wanted, that is a separate system-prompt change.

## In scope
- Augmenting the chat empty state in `ChatThread.tsx` with a "how to use" blurb.

## Out of scope
- Any system-prompt change (`apps/web/lib/chat/system-prompt.ts`), including adding an explicit Spanish/language instruction.
- A persistent (post-conversation) help affordance, modal, or tooltip.
- A reports-style `helpText` registry for chat.
- UI localization / i18n.
- Changes to `SUGGESTED_PROMPTS` content or to any chat tool.

## Institutional bites that apply
- **App Router conventions** (`apps/web/AGENTS.md`): this is a modified Next.js with breaking changes. `ChatThread.tsx` is already a `"use client"` component; this change is plain JSX text with no new hooks or boundaries, so no client/server boundary concern.
- **No automated tests today** (Test infrastructure section): verification is `pnpm build` + `pnpm lint` + a manual smoke check. No test scaffold required for a static-text change.
- No data-model, RLS, or Zod-boundary items apply — no schema or input changes.

## Verification protocol
1. `pnpm lint` — passes.
2. `pnpm build` — passes.
3. Manual smoke check on `/chat`: open a fresh chat with no conversation; confirm the new blurb renders below "Ask anything about your inventory." and above the suggested-prompt chips, styled as muted helper text.
4. Send a message (or click a suggested prompt); confirm the blurb and chips disappear once `messages.length > 0`, and the conversation renders normally.
5. Check dark mode renders the blurb legibly.

## Future work (out of this ticket)
- If the client wants guaranteed Spanish-language replies, add an explicit language instruction to `buildSystemPrompt` in `apps/web/lib/chat/system-prompt.ts`.
- If a persistent in-conversation help affordance is later desired, revisit a small "?" toggle near the chat header.

## Open questions
None — the ticket is unambiguous given the unilateral decisions above.
