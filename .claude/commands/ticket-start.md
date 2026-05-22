---
description: Start a new feature ticket — fetches OpenProject, creates branch, generates SPEC and OPEN_QUESTIONS
argument-hint: [TICKET-ID]
allowed-tools: Read, Write, Bash(git checkout:*, git branch:*, git fetch:*, git pull:*, curl:*)
---

Start feature work on OpenProject ticket #$1.

## Step 1: Fetch the ticket

Invoke the `openproject-intake` agent with ticket id $1. It will:
- Save `docs/tickets/$1.md` with verbatim ticket content
- Report whether this looks like a bug or feature

If `openproject-intake` recommends bug flow, stop and tell the user to run `/bug-start $1` instead.

## Step 2: Create branch

Derive a short kebab slug from the ticket subject (max 4 words). Branch name: `ticket-$1-<slug>`.

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b ticket-$1-<slug>
```

If the branch already exists, switch to it and warn the user.

## Step 3: Reminder to transition OpenProject

Remind the user: "Per standing rules, transition #$1 to 'In progress' in OpenProject when you start coding. (Or authorize me to do it via the API.)"

Do NOT transition the ticket without explicit authorization.

## Step 4: Generate SPEC

Invoke `spec-writer`. It will produce:
- `docs/tickets/$1_SPEC.md`
- `docs/tickets/$1_OPEN_QUESTIONS.md` (only if ambiguity exists)

## Step 5: Report

Print to user:
1. Branch created and current.
2. SPEC location.
3. OPEN_QUESTIONS location if present — instruct user to answer in that file and tell you "questions answered" when done.
4. Next step: invoke `test-author` (or resolve open questions first).

Stop after step 5.
