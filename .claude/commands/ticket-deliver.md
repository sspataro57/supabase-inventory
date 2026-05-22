---
description: Finalize ticket — runs build/lint/tests, drafts PR description, optionally creates via gh
argument-hint: [TICKET-ID]
allowed-tools: Read, Write, Bash(pnpm:*, npx playwright:*, git:*, gh pr:*)
---

Finalize OpenProject ticket #$1 for delivery.

Prerequisites: implementation done, `/ticket-review` passed, current branch is `ticket-$1-*`.

## Step 1: Verify state

- `git status` — clean working tree
- Current branch matches `ticket-$1-*`
- Both SPEC/DIAGNOSIS and ticket files exist in `docs/tickets/`

If anything is off, stop.

## Step 2: Build + lint

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm build
```

If any step fails, stop and report. Do not proceed.

## Step 3: Run tests

```bash
pnpm test
```

If a Playwright project is configured, also:
```bash
npx playwright test
```

If any failures, stop and report.

## Step 4: Migration check

If `git diff main...HEAD --name-only | grep '^supabase/migrations/'` is non-empty:
- Confirm types were regenerated: diff should include `packages/shared/src/db.ts`. If not, run `pnpm db:types` locally first.
- Confirm the migration is reversible or note in the PR that it isn't.

## Step 5: Draft PR

Invoke `pr-writer`. It will produce:
- PR title (`Short imperative summary (OpenProject #$1)`)
- PR body (Summary + Test plan + Risk & rollback + Out of scope + Migrations if applicable)

`pr-writer` will print the draft and ask for authorization to create via `gh pr create`.

## Step 6: Report

Print final state:
1. Test / build / lint results
2. PR URL if created, or draft for manual creation
3. Reminder: do not push subsequent commits to the PR without re-running `/ticket-review`
4. Reminder: the user transitions the OpenProject ticket after merge — you do not transition.

Stop.
