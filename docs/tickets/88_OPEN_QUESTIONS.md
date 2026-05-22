# Open Questions — OpenProject #88

1. **The string `'ljjl'` does not exist anywhere in the current codebase.** A repo-wide
   case-insensitive grep (`apps/`, `packages/`, `supabase/`) returns only `docs/tickets/88.md`
   itself. `apps/web/components/ChatThread.tsx` already initializes the chat input to `""`
   (`useState("")`, line 36) and uses an intentional `placeholder="Ask about inventory…"`
   (line 216). It looks like the placeholder was already removed by an earlier commit on the
   #69 branch. Is this ticket already satisfied (i.e. close it as verified-fixed with a
   reference to the #69 commit), or did you observe `ljjl` on a deployed/older build that we
   should investigate further?

   **Answer:**

2. (Only if Q1 says it is still reproducing) On which build/branch and which exact field did
   you see `'ljjl'` — the chat composer in `ChatThread.tsx`, or some other input? If it is
   somewhere other than `ChatThread.tsx`, point me at the route so I can locate the literal.

   **Answer:**

---

Answer in this file by editing the question entries above. When done, tell me "questions answered"
and I'll fold them into the SPEC.
