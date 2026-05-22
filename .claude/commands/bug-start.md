---
description: Start a bug ticket — fetches OpenProject, creates branch, runs reproduction-first flow
argument-hint: [TICKET-ID]
allowed-tools: Read, Write, Bash(git checkout:*, git branch:*, git fetch:*, git pull:*, curl:*)
---

Start bug investigation on OpenProject ticket #$1.

## Step 1: Fetch the ticket

Invoke `openproject-intake` with ticket id $1. Save the ticket content. If the agent thinks this is actually a feature, warn the user but proceed if they confirm.

## Step 2: Create branch

Derive a short kebab slug from the ticket subject. Branch name: `ticket-$1-<slug>`.

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b ticket-$1-<slug>
```

## Step 3: Stack reset check

Remind: "Bug reproduction requires a clean local stack. If you haven't already: `supabase stop && supabase start` to reset local Supabase, `pnpm install` if deps drifted, `pnpm --filter web dev` to bring up the app. The `bug-reproducer` agent will check stack health but won't trigger the reset itself."

Ask: "Has the stack been reset for this session? (y/n)"

If no, stop and let the user reset before continuing.

## Step 4: OpenProject transition reminder

Remind: "Per standing rules, transition #$1 to 'In progress' when you start. Authorize me explicitly if you want me to do it via the API."

## Step 5: Run reproduction

Invoke `bug-reproducer`. It will:
- Identify the reproduction surface (Playwright / Vitest / curl / SQL)
- Write a failing reproduction script or test
- Produce `docs/tickets/$1_REPRO.md`
- Refuse to investigate cause until reproduction works

## Step 6: Report

Print to user:
1. Branch state
2. Reproduction status (Confirmed / Cannot reproduce / Needs more info)
3. Reproduction artifact location
4. Next step: if Confirmed, invoke `bug-diagnoser`. If Cannot reproduce, gather more info or close ticket.

Stop after step 6. Do NOT proceed to diagnosis without explicit user authorization.
