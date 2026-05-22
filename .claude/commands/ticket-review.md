---
description: Pre-PR review — runs code-reviewer (Claude) then /codex:adversarial-review (cross-vendor)
argument-hint: [TICKET-ID]
allowed-tools: Read, Bash(git status:*, git diff:*, git log:*)
---

Run the two-stage review for OpenProject ticket #$1 before PR.

## Step 1: Verify state

Check `git status` — working tree should be clean. Check `git log main..HEAD` — there should be commits. If either is off, stop and tell the user.

Confirm `docs/tickets/$1_SPEC.md` or `docs/tickets/$1_DIAGNOSIS.md` exists (this is what we're reviewing against).

## Step 2: Run code-reviewer

Invoke `code-reviewer`. It will produce a structured review report covering scope, institutional bites, Next.js/Supabase conventions, migrations + types, tests, and commit hygiene.

If the recommendation is "Address findings, then re-review" — surface the findings to the user and stop. The user fixes, then re-runs `/ticket-review`.

If the recommendation is "Ready for adversarial review" — continue.

## Step 3: Run Codex adversarial review

Run `/codex:adversarial-review --base main` (requires codex plugin installed in this workspace).

If the codex plugin isn't installed, tell the user and offer to skip this step (less safe) or install the plugin first. Do NOT silently skip.

Codex review may take several minutes for non-trivial diffs.

## Step 4: Synthesize

After both reviews complete, print:

1. `code-reviewer`'s recommendation (one line)
2. `code-reviewer`'s top 3 findings
3. Codex adversarial review's findings, grouped by severity
4. Overall recommendation:
   - "Proceed to PR" — if both reviews are clean
   - "Address findings, then re-run review" — if either flagged real issues
   - "Two reviews disagree on X — human judgment needed" — if reviews conflict

Stop after step 4. The user decides whether to address or run `/ticket-deliver`.
