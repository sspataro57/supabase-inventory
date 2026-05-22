# Technical Spec — Ticket #93

> **Status:** FINAL. All open questions resolved. The prior `docs/tickets/93_OPEN_QUESTIONS.md` is stale and is to be deleted separately. Ready for `test-author`.

## Source

`docs/tickets/93.md` — "Users: agregar opción para crear nuevo usuario". Feature (OpenProject type id 4), derived from parent ticket #69 (USERS section). Verbatim client ask from #69: "USERS: No veo la opción para crear un nuevo usuario."

## Goal

The "+ New User" creation flow on `/users` already exists and works; the only blocker is a chicken-and-egg admin lockout (a fresh deployment has zero admins, and every admin-promotion path requires a pre-existing admin). #93 is delivered by two things, **neither of which is an automatic admin promotion**:

1. **A migration that closes the `profiles.email` self-mutation RLS gap** — it drops and recreates the `profiles_update_self` policy so its `WITH CHECK` pins `email` in addition to the pre-existing `role`. This stops a user from rewriting their own `profiles.email`, which makes `profiles.email` — and therefore any operator bootstrap that keys off it — trustworthy.
2. **A documented operator runbook step** — after deploy, an operator runs the existing `packages/db/scripts/bootstrap-admin.ts` script (service-role key) once, after verifying the owner account's identity, to mint the first admin. This is a deliberate, human-verified action; it is the only safe way to mint a first admin given open, unconfirmed public signup.

Once the first admin exists, `/users` is reachable for that admin and the pre-existing "+ New User" flow works end-to-end.

## Investigation summary (resolved — do not re-investigate)

The create-user feature **already exists and works**:

- `apps/web/components/NewUserForm.tsx` — `"use client"` component rendering a "+ New User" button and a modal collecting email / display_name / password / role.
- `apps/web/app/(admin)/users/page.tsx:17` — renders `<NewUserForm action={createUser} />` in the page header.
- `apps/web/app/(admin)/users/actions.ts:23-65` — `createUser` server action: `requireAdmin()` gate → service-role client → `auth.admin.createUser({ email_confirm: true })` → `profiles.update` for role + display_name → `writeAudit` → `revalidatePath("/users")`. Correct (route groups like `(admin)` are not part of the URL path, so `"/users"` is right).

The **real defect** is an admin lockout, not a missing button:

- `supabase/migrations/20260506000011_profile_signup_trigger.sql:5` — `handle_new_user()` hardcodes `role = 'user'` for every new profile.
- `supabase/migrations/20260506000002_profiles.sql:5` — the `profiles.role` column default is also `'user'`.
- `supabase/seed.sql` — seeds units and the preferences singleton only; no admin profile.
- `createUser` (line 23) and `setUserRole` (line 67) in `actions.ts` both call an admin gate (`requireAdmin()` / inline `myProfile?.role !== 'admin'`) before they can promote anyone.
- Result: a fresh deployment has **zero** admins and no in-app mechanism to mint the first one.
- `apps/web/app/(admin)/layout.tsx:16` — non-admins are `redirect("/dashboard")`-ed, so `/users` is unreachable.
- `apps/web/components/NavBar.tsx:24-29` — the "Users" nav link is admin-gated and hidden from non-admins.

So the client genuinely cannot "see the option to create a user" — not because the UI is missing, but because they are not an admin and cannot reach the screen.

`public.profiles.email` (`supabase/migrations/20260506000002_profiles.sql:3`) is `text not null` with **no unique constraint**, and the `profiles_update_self` RLS policy (`supabase/migrations/20260506000010_rls.sql:16-18`) lets a user update their own row with a `WITH CHECK` that pins only `role` — **not** `email`. So today `profiles.email` is freely user-mutable. This is a pre-existing gap, independent of #93, but it is the gap that this ticket closes (see Decisions made unilaterally).

The first admin is bootstrapped **out of band**, not by the migration. `packages/db/scripts/bootstrap-admin.ts` (promotes a profile to admin by email using the service-role key) and `packages/db/scripts/create-user.ts` already exist for operator use. The user has confirmed `sspataro@gmail.com` already has a production account, so bootstrapping the first admin in production is a single operator command.

## Decisions made unilaterally

1. **No automatic, email-keyed admin promotion — at all.** Earlier rounds of this SPEC proposed an automatic promotion: first a one-time `UPDATE` keyed off the owner's email, then a self-healing `BEFORE INSERT` trigger. A Codex adversarial review (round 3, see "Adversarial review outcome") showed that **both** are unsafe. This project has public email signup **enabled** and email confirmation **disabled** (`supabase/config.toml`), and the anon Supabase client is public. Email is therefore **not a verified identity** here: anyone can `signUp` with any address, including the owner's, and the account is usable immediately. Any database object that automatically grants `admin` based on a matching email could be claimed by an attacker who signs up with the owner's address before the real owner does — a first-admin takeover. The final design has **no automatic promotion**: the migration promotes no one, and creates no trigger and no function.
2. **The migration is RLS-hardening plus one UNIQUE constraint plus a one-time data reconciliation.** The migration drops and recreates the `profiles_update_self` policy so its `WITH CHECK` pins `email` as well as `role`, adds a `UNIQUE` constraint on `profiles.email` (see decision 6), and runs one reconciling `UPDATE` that restores `profiles.email` from `auth.users.email` (see decision 7). It alters no column type and adds no function or trigger.
3. **Why the RLS hardening is in scope even though the gap predates #93.** The `profiles.email` self-mutation gap is pre-existing, but it is directly load-bearing for #93: the operator bootstrap (`bootstrap-admin.ts`) keys off `profiles.email`, so if `profiles.email` is user-mutable the bootstrap is itself an escalation vector — any user could set their own `profiles.email` to the owner's address and be promoted by an operator who trusts that column. Pinning `email` in `profiles_update_self` makes `profiles.email` trustworthy and the operator bootstrap safe. The user **explicitly approved** including this hardening in #93.
4. **The first admin is operator-bootstrapped via `bootstrap-admin.ts`.** Given open, unconfirmed signup, the only safe way to mint a first admin is a deliberate, human-verified runbook action: an operator, having confirmed the owner account's identity, runs `bootstrap-admin.ts <owner-email>` once with the service-role key. This is a first-class deliverable of the ticket (see "Operator runbook"), not a fallback. The user has confirmed `sspataro@gmail.com` already has a production account, so in production this is a single command.
5. **No new UI, no new route, no new server action.** The button, modal, and `createUser` action all already exist and are correct. Touching them is out of scope.
6. **`profiles.email` is made `UNIQUE`.** The migration adds `constraint profiles_email_key unique (email)` so the operator bootstrap (`bootstrap-admin.ts`, which keys off `profiles.email`) is **provably single-target** — it can match at most one row, so it can promote at most one profile. This also corrects a long-standing schema gap: `profiles.email` mirrors `auth.users.email` (copied by `handle_new_user()` at signup), which is itself unique, so the mirror should always have been unique. The reconcile step (decision 7) runs first and clears any duplicate emails that prior tampering may have created, so this `alter table` succeeds. The user **explicitly approved** this addition.
7. **The migration reconciles `profiles.email` from `auth.users.email` before locking it.** Pinning `email` in `profiles_update_self` only prevents *future* mutation — it cannot un-poison a row a user already rewrote under the old policy (which pinned `role` but not `email`). Such a poisoned row, if left as-is, would simply be *frozen* by the lock and could survive into the operator bootstrap, which keys off `profiles.email` and could then promote the wrong profile. So the migration first runs a reconciling `UPDATE` that restores every `profiles.email` to the matching `auth.users.email`. `auth.users` is the identity source of truth: Supabase Auth owns it and a user cannot rewrite it via the public anon client. After reconciliation, any value poisoned under the old policy is corrected (not frozen), tamper-induced duplicates are cleared so the `UNIQUE` constraint can be added, and `profiles.email` provably mirrors `auth.users.email`.

## Acceptance criteria

> Quoted (from parent #69): "USERS: No veo la opción para crear un nuevo usuario."

1. A new migration file under `supabase/migrations/` **drops and recreates** the `profiles_update_self` RLS policy on `public.profiles` so its `WITH CHECK` pins `email` (in addition to the pre-existing `role` pin) to the caller's current stored value.
2. After the migration is applied, a regular authenticated (non-admin) user **cannot** change their own `profiles.email` — an `UPDATE` that alters `email` is rejected by the tightened `profiles_update_self` `WITH CHECK`.
3. After the migration is applied, a regular authenticated (non-admin) user **cannot** change their own `profiles.role` — the pre-existing `role` pin is preserved.
4. After the migration is applied, a regular authenticated (non-admin) user **can** still update their own `profiles.display_name` (and any other self-editable field other than `role` and `email`) via `profiles_update_self`.
5. The migration **creates no trigger and no function** and **promotes no profile** — its only data effect is the reconciling `UPDATE` of `profiles.email`; its only structural effects are the `profiles_update_self` policy replacement and the addition of one `UNIQUE` constraint.
6. **Documented runbook:** the SPEC documents that, after the migration is deployed, an operator runs `packages/db/scripts/bootstrap-admin.ts <owner-email>` (with the service-role key) once to mint the first admin. After that runs against a database where the owner has signed up, that user's `profiles.role` is `'admin'`, the "Users" link appears in `NavBar` (`apps/web/components/NavBar.tsx:24-29`), the `(admin)` layout (`apps/web/app/(admin)/layout.tsx:16`) does not redirect them away from `/users`, and on `/users` they can use the pre-existing "+ New User" flow end-to-end (open the modal, submit a valid email + password ≥8 chars + role, and the new user appears after `revalidatePath("/users")`).
7. After the migration is applied, `public.profiles.email` has a `UNIQUE` constraint (`profiles_email_key`).
8. After the migration is applied, inserting or updating a `profiles` row to an `email` value that already exists on another row fails with a unique-violation error.
9. The migration's reconcile step **repairs** a `profiles.email` that differs from the matching `auth.users.email`: given a `profiles` row whose `email` was drifted/poisoned away from its `auth.users.email`, after the migration that row's `profiles.email` equals its `auth.users.email`.
10. The migration's reconcile step **leaves unchanged** a `profiles.email` that already equals the matching `auth.users.email` — the `is distinct from` guard means a matching row is not rewritten.

## Data model changes

**One reconciling data `UPDATE`; one UNIQUE constraint added; one RLS policy tightened; no table/column/type change.** `profiles.role`'s column default stays `'user'`. The migration **creates no function and no trigger**. It adds no table, column, index, CHECK, PK, or FK; it adds exactly one `UNIQUE` constraint, runs exactly one data `UPDATE` (the reconcile, which promotes no one), and replaces exactly one RLS policy.

The migration has **three ordered steps**, and the order matters:

1. **Reconcile `profiles.email` from `auth.users.email`** — a one-time `UPDATE` that restores every `profiles.email` that drifted (or was poisoned under the old self-mutable policy) to the `auth.users.email` source of truth. **Must run first**, because it resolves any tamper-induced duplicate `profiles.email` values, which is what lets step 2 succeed.
2. **Add a `UNIQUE` constraint on `profiles.email`** — `alter table public.profiles add constraint profiles_email_key unique (email);`. This makes the operator bootstrap single-target (see "Decisions made unilaterally" #6).
3. **Replace one existing RLS policy** — `drop policy` and recreate `profiles_update_self` on `public.profiles` with a tightened `WITH CHECK`.

- **File:** `supabase/migrations/20260522000000_lock_profiles_email.sql`
  - Naming: timestamp prefix `YYYYMMDDhhmmss`, consistent with the two most recent migrations (`20260521120000_locations.sql`, `20260521130000_report_inventory_by_location.sql`). Today is 2026-05-22; `20260522000000` sorts strictly after every existing migration, which is required because `supabase db push` applies files in lexical order.

- **Step 1 — the reconcile `UPDATE`** — `profiles.email` is a mirror of `auth.users.email`, but under the old `profiles_update_self` policy (which pinned `role` but not `email`) a user could rewrite their own `profiles.email`. Pinning `email` going forward does not un-poison a row already tampered with — it merely *freezes* it, and a frozen poisoned row could survive into the operator bootstrap and cause the wrong profile to be promoted. This step restores the mirror to the source of truth before the lock is applied. `auth.users` is owned by Supabase Auth and is not mutable via the public anon client, so it is the trustworthy identity source. The `is distinct from` guard ensures rows that already match are not rewritten:

  ```sql
  -- Step 1: reconcile profiles.email back to the auth.users.email source of
  -- truth. Under the OLD profiles_update_self policy (which pinned role but not
  -- email) a user could have poisoned their own profiles.email. Pinning email
  -- below only freezes such a row; it does not correct it. Run this FIRST so any
  -- poisoned value is repaired (not frozen) and any tamper-induced duplicate
  -- emails are cleared before the UNIQUE constraint in step 2 is added.
  update public.profiles p
     set email = u.email
    from auth.users u
   where p.id = u.id
     and u.email is not null
     and p.email is distinct from u.email;
  ```

- **Step 2 — the UNIQUE constraint** — `profiles.email` mirrors the unique `auth.users.email` but never carried the constraint itself. Adding it makes `bootstrap-admin.ts` (which runs `update profiles ... where email = <owner email>`) provably single-target: it can match at most one row. Because step 1 has already reconciled every `profiles.email` to its (unique) `auth.users.email`, no duplicate emails remain and this `alter table` succeeds. (If it nonetheless fails on a duplicate, that is a data-integrity signal — a row whose `id` does not match any `auth.users` row, or other drift — and must be investigated before bootstrapping.)

  ```sql
  alter table public.profiles add constraint profiles_email_key unique (email);
  ```

- **Step 3 — the policy replacement** — closes the email-mutation escalation vector at its source. The recreated policy keeps the existing `USING (id = auth.uid())` and the existing `role`-pin in `WITH CHECK`, and **adds** an `email`-pin so a self-update cannot change `email`:

  ```sql
  -- Lock profiles.email against self-mutation (OpenProject #93, derived from #69).
  --
  -- The existing profiles_update_self policy pins `role` in its WITH CHECK but
  -- not `email`, so any authenticated user can rewrite their own profiles.email.
  -- profiles.email is set once by handle_new_user() at signup and has no
  -- legitimate self-service update path. Leaving it mutable makes the operator
  -- first-admin bootstrap (packages/db/scripts/bootstrap-admin.ts, which keys off
  -- profiles.email) an escalation vector: a user could set their own email to the
  -- owner's address and be promoted. Pinning `email` here closes that gap.
  --
  -- This migration promotes nobody and creates no trigger or function. The first
  -- admin is bootstrapped out of band by an operator running bootstrap-admin.ts —
  -- see the SPEC "Operator runbook" section. Automatic email-keyed promotion is
  -- intentionally NOT used: public signup is open and unconfirmed, so email is
  -- not a verified identity (round-3 CRITICAL finding).
  drop policy profiles_update_self on public.profiles;
  create policy profiles_update_self on public.profiles for update
    using (id = auth.uid())
    with check (
      id = auth.uid()
      and role  = (select role  from public.profiles where id = auth.uid())
      and email = (select email from public.profiles where id = auth.uid())
    );
  ```

  `profiles.email` is written once by `handle_new_user()` at signup and has no legitimate self-service update path, so pinning it restricts no real user action; `display_name` (and any non-`role`/non-`email` field) stays editable. The sibling `profiles_update_admin` policy is **not** touched — admins retain full update rights.

- **RLS:** the migration *is* an RLS-policy change as described above. `profiles_update_admin` continues to govern in-app admin updates unchanged, and `profiles_select` is untouched, so `profiles` RLS stays fully covered.

### Types regeneration

**Not required — and this was verified, not assumed.** `pnpm db:types` regenerates `packages/shared/src/db.ts` from the schema. Running `pnpm db:types` after this migration produces a byte-identical `db.ts`: the generated types surface only tables, views, enums, columns, and RPC (`Functions`) entries, and a single-column `UNIQUE` constraint does not change any column type or table shape — `Supabase`'s type generator does not represent constraints in the output. The reconcile `UPDATE` is a data change, not a schema change, so it likewise produces no `db.ts` diff. The RLS-policy replacement likewise does not appear. Confirmed by running `pnpm db:types`: no diff. The institutional convention "regenerate types after a schema change" was honored (the command was run) and produced no diff. State this explicitly in the PR so a reviewer does not flag a missing `db.ts` diff.

## API / route changes

**None.** No App Router route, route handler, or server action is added or modified. `createUser`, `setUserRole`, `setUserActive` in `apps/web/app/(admin)/users/actions.ts` are unchanged.

## UI changes

**None.** `NewUserForm.tsx`, `users/page.tsx`, `(admin)/layout.tsx`, and `NavBar.tsx` are all already correct and unchanged. Their behavior simply becomes *reachable* once a real admin exists (minted via the operator runbook).

## Files likely to touch

- `supabase/migrations/20260522000000_lock_profiles_email.sql` — **NEW**, the only file this ticket creates. It contains the three ordered steps: the reconciling `update public.profiles ... from auth.users` data `UPDATE`, the `alter table ... add constraint profiles_email_key unique (email)`, and the single `drop policy` / `create policy` replacement of `profiles_update_self`. It creates no function and no trigger.

No other files require changes. Files read during investigation but **not** modified (listed so a reviewer knows they were considered): `apps/web/app/(admin)/users/actions.ts`, `apps/web/app/(admin)/users/page.tsx`, `apps/web/app/(admin)/layout.tsx`, `apps/web/components/NewUserForm.tsx`, `apps/web/components/NavBar.tsx`, `apps/web/lib/supabase/service.ts`, `supabase/migrations/20260506000002_profiles.sql`, `supabase/migrations/20260506000010_rls.sql`, `supabase/migrations/20260506000011_profile_signup_trigger.sql`, `supabase/seed.sql`, `supabase/config.toml`, `packages/db/scripts/bootstrap-admin.ts`.

## Operator runbook

Minting the first admin is **out of band** — it is not part of the migration or the deploy pipeline. After the migration in this ticket is deployed (so `profiles.email` is trustworthy), an operator runs the existing bootstrap script once.

**When:** after the deployment that includes `20260522000000_lock_profiles_email.sql`, and after the owner account exists. The user has confirmed `sspataro@gmail.com` already has a production account, so this can be done immediately post-deploy. On a fresh deployment where the owner has not yet signed up, run it after the owner has signed up.

**Command** (run by an operator who has verified the owner account's identity):

```sh
# From packages/db, with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set
# (SUPABASE_URL defaults to http://127.0.0.1:54321 for local).
npx tsx scripts/bootstrap-admin.ts sspataro@gmail.com
```

`bootstrap-admin.ts` runs an `update profiles set role='admin' where email = <arg>` through the **service-role key** (it bypasses RLS). It requires `SUPABASE_SERVICE_ROLE_KEY` to be set; if the key is absent or no profile matches the email, the script exits non-zero with a clear message. The script is naturally re-runnable (re-running sets `role` to the same value).

Because the migration's step 1 reconciles every `profiles.email` from `auth.users.email`, the migration **self-heals any email drift**: by the time the operator runs `bootstrap-admin.ts`, `profiles.email` is guaranteed to mirror `auth.users.email` (the Supabase Auth-owned source of truth) — no pre-migration tampering can survive into the bootstrap. Because `profiles.email` is then also `UNIQUE` (`profiles_email_key`), `bootstrap-admin.ts` is guaranteed to match **exactly one** row — the bootstrap is provably single-target and cannot promote a second or poisoned profile. If the migration `20260522000000_lock_profiles_email.sql` itself **failed to apply** (for example because a `profiles` row has no matching `auth.users` row and a residual duplicate `email` remained), that failure must be investigated and resolved **before** bootstrapping — bootstrapping against an unmigrated database leaves `profiles.email` neither reconciled nor unique.

**Why this is the only safe path:** automatic, email-keyed promotion is unsafe here because public signup is open and unconfirmed (see "Adversarial review outcome", round 3). A deliberate operator action — verifying the owner's identity, then running a service-role script — is a human-in-the-loop check that an automatic database object cannot provide.

## Secondary hardening (lower priority — deployment checklist, not a code change)

`createUser` calls `createServiceClient()` (`apps/web/lib/supabase/service.ts:5-11`), which reads `process.env.SUPABASE_SERVICE_ROLE_KEY!` with a non-null assertion. The variable is present in `.env.example` and `.env.local`, so local dev is fine. **In production (Vercel), if `SUPABASE_SERVICE_ROLE_KEY` is not set, the first call to `createServiceClient()` produces a client built on `undefined`, and `auth.admin.createUser` fails at runtime** — meaning an admin who finally reaches `/users` still gets a runtime error on submit. The same key is what the operator runbook needs.

This is a **deployment checklist item**, not necessarily code:

1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set in the production Vercel project environment (all of Production / Preview as appropriate). Per institutional rules this key is server-only — it must **not** be `NEXT_PUBLIC_`-prefixed and must never reach the browser bundle.
2. Optional, out of scope for this ticket: a future ticket could replace the `!` non-null assertion in `service.ts` with an explicit guard that throws a clear "service role key not configured" message instead of failing obscurely. Noted under "Future work", not specified here.

## In scope

- A single migration that (a) reconciles `profiles.email` from the `auth.users.email` source of truth so any value poisoned under the old policy is repaired (not frozen) and tamper-induced duplicates are cleared, (b) adds a `UNIQUE` constraint (`profiles_email_key`) on `profiles.email` so the operator first-admin bootstrap is provably single-target, and (c) tightens the `profiles_update_self` RLS policy so a non-admin user cannot change their own `profiles.email` — together making `profiles.email` provably equal to `auth.users.email`, unique, and immutable, which closes the privilege-escalation vector that would otherwise make the operator first-admin bootstrap unsafe. The user explicitly approved including these in #93 even though the underlying gaps predate the ticket.
- A documented operator runbook (above) for minting the first admin via `packages/db/scripts/bootstrap-admin.ts`.
- Verification that, post-bootstrap, the existing "+ New User" flow is reachable and functional for that admin.

## Out of scope

- **Any automatic admin promotion.** No one-time email-keyed `UPDATE`, no `BEFORE INSERT` trigger, no function. Automatic, email-keyed promotion is unsafe while public signup is open and unconfirmed (round-3 CRITICAL finding). Minting the first admin is operator-driven via `bootstrap-admin.ts`. (Note: the migration's reconcile `UPDATE` is *not* a promotion — it touches only `profiles.email`, never `profiles.role`.)
- Changing `handle_new_user()` or the `profiles.role` column default — both must keep defaulting new signups to `'user'`.
- Changing signup or email-confirmation configuration in `supabase/config.toml`. Disabling open public signup and/or enabling email confirmation are real hardening options but are a separate decision outside this ticket.
- Building, restyling, or rewiring the "+ New User" button, modal, or `createUser` action — they already exist and work.
- Adding/removing fields on the create-user form (email / display_name / password / role stay as-is).
- An invite-via-magic-link flow (`auth.admin.inviteUserByEmail`) — separate ticket if ever wanted.
- A self-serve / public signup-to-admin path.
- Editing existing users beyond the role and `is_active` toggles already present.
- Deleting users.
- Changing `service.ts` to guard the missing-env case (noted as future work; this ticket only documents the deployment-checklist item).
- Seeding an admin in `supabase/seed.sql`.
- Touching the `profiles_update_admin` policy or any RLS policy other than `profiles_update_self` — admins retain full update rights and only the self-update path is tightened.

## Adversarial review outcome

The SPEC was put through Codex adversarial review across five rounds. The first two rounds drove a design that the third round discarded; the round history is kept so the reasoning is auditable.

**Round 1 findings:**

- **HIGH — fresh-deployment 0-row no-op.** The original design was a data-only `UPDATE` keyed off the owner's email. On a fresh deployment, `supabase db push` runs migrations *before* the owner signs up, so the `UPDATE` matches 0 rows, the migration is recorded as applied, and the owner is never promoted. Round 1 addressed this with a `BEFORE INSERT` trigger.
- **MEDIUM — destructive test.** A test as originally sketched would have been destructive against the local DB.

**Round 2 findings (re-review):**

- **HIGH — privilege escalation via mutable, non-unique `profiles.email`.** The round-1 design keyed the bootstrap off `public.profiles.email`, which has **no unique constraint** and is **user-mutable** (the `profiles_update_self` `WITH CHECK` pinned `role` but not `email`). Any authenticated user could rewrite their own `profiles.email` to the owner's address and be promoted. Round 2 re-keyed the automatic `UPDATE` off `auth.users.email` and added the `profiles_update_self` RLS hardening.

**Round 3 findings (re-review) — and the resolution that discarded automatic promotion:**

- **CRITICAL — even a one-time, email-keyed automatic promotion is unsafe.** The round-2 design still promoted automatically: a one-time `UPDATE` keyed off `auth.users.email`, plus a self-healing `BEFORE INSERT` trigger. Codex showed that **any** automatic admin grant keyed off an email is unsafe in this project, because public email signup is **enabled** and email confirmation is **disabled** (`supabase/config.toml`) and the anon Supabase client is public. An attacker can call Auth `signUp` with the owner's email and a password of their choosing *before the real owner does*; `handle_new_user()` creates the profile, and any email-keyed automatic promotion — trigger **or** one-time `UPDATE` against `auth.users` — then grants that attacker `admin`, yielding a complete first-admin takeover. Email is not a verified identity here, so it cannot be the sole key to an admin grant.
- **Resolution:** **remove all automatic promotion.** The migration promotes no one and creates no trigger or function. Its effect is the `profiles_update_self` RLS hardening, which is correct and valuable on its own (it makes `profiles.email` trustworthy). The first admin is minted **out of band** by an operator running `packages/db/scripts/bootstrap-admin.ts` after verifying the owner's identity — a human-in-the-loop check that no automatic database object can replicate. The migration file was consequently renamed from `..._bootstrap_first_admin.sql` to `20260522000000_lock_profiles_email.sql` to reflect its true scope.

**Round 4 findings (re-review) — and the resolution:**

- **HIGH — operator bootstrap trusts non-unique `profiles.email`.** The round-3 design left the operator bootstrap (`bootstrap-admin.ts`, which runs `update profiles ... where email = <owner email>`) keyed off `profiles.email`, a column that — even with the RLS `email`-pin preventing *self*-mutation — still had **no `UNIQUE` constraint**. A pre-existing duplicate row, or a row poisoned before the RLS lock shipped, could mean the bootstrap `UPDATE` matches more than one row and promotes an unintended profile to `admin`.
- **Resolution:** the migration now also adds `alter table public.profiles add constraint profiles_email_key unique (email)`. With it, `bootstrap-admin.ts` matches at most one row — the bootstrap is provably single-target. Combined with the RLS `email`-pin, `profiles.email` is now both **unique** and **immutable by its owner**, so the operator bootstrap can no longer promote a duplicate or poisoned row.

**Round 5 findings (final re-review) — and the resolution:**

- **CRITICAL — the lock froze `profiles.email` rather than verifying it.** The round-4 design added the `UNIQUE` constraint and the RLS `email`-pin, but it **trusted** the existing `profiles.email` values without ever verifying they still mirror `auth.users.email`. A row a user *poisoned before the migration* — while the old `profiles_update_self` policy still permitted email mutation — would simply be **frozen** by the new lock, not corrected. The operator bootstrap (`bootstrap-admin.ts`), which keys off `profiles.email`, could then promote that wrong, attacker-controlled profile. Adding the `UNIQUE` constraint alone does not help: a poisoned-but-unique email is still poisoned.
- **Resolution:** the migration now has **three ordered steps**, with a new step 1 added at the front: a reconciling `UPDATE` that restores every `profiles.email` to the matching `auth.users.email` (`update public.profiles p set email = u.email from auth.users u where p.id = u.id and u.email is not null and p.email is distinct from u.email;`). It runs **first**, so it both repairs any pre-migration poisoning and clears any tamper-induced duplicate emails, letting the `UNIQUE` constraint in step 2 apply cleanly. After the migration, `profiles.email` **provably equals** `auth.users.email` (the Supabase Auth-owned, anon-immutable identity source of truth), is **unique**, and is **immutable by its owner** — so the operator bootstrap is fully sound.

## Institutional bites that apply

From `.claude/INSTITUTIONAL_KNOWLEDGE.md`:

- **"All schema changes go through `supabase/migrations/` SQL files."** — the reconcile `UPDATE`, the `UNIQUE` constraint, and the `profiles_update_self` policy replacement are all delivered as one migration so they run through `.github/workflows/migrate.yml` (`supabase db push`) on the deploy branch, rather than being applied to the DB directly.
- **"RLS must ship with the migration / RLS is on for every user-facing table."** — this migration *is* an RLS change. The replacement `profiles_update_self` policy keeps `profiles` RLS fully covered (the sibling `profiles_select` and `profiles_update_admin` policies are untouched).
- **"After every schema change, regenerate types: `pnpm db:types`."** — honored: `pnpm db:types` was run and produced **no** `packages/shared/src/db.ts` diff (a single-column `UNIQUE` constraint, an RLS-policy replacement, and a data `UPDATE` do not surface in generated types — column types are unchanged). Call this out in the PR description to preempt a reviewer flag.
- **"Migrations under `supabase/migrations/` are auto-applied by `.github/workflows/migrate.yml` on push to the deploy branch."** — the new file's timestamp prefix (`20260522000000`) must sort after all existing migrations so `supabase db push` applies it last; it does.
- **"The `service_role` key is server-only — never exposed to the browser."** — relevant both to the secondary hardening note and to the operator runbook: `SUPABASE_SERVICE_ROLE_KEY` must be a plain (non-`NEXT_PUBLIC_`) server env var, and `bootstrap-admin.ts` needs it to run.
- **Branch / commit conventions** — branch `ticket-93-<slug>`; commit summary ends with `(OpenProject #93)`; no `Co-Authored-By: Claude` trailer.

## Verification protocol

Before opening a PR:

1. **Lint/build:** `pnpm lint` and `pnpm build` — should be unaffected (no app code changed); run them to confirm nothing else regressed.
2. **Test:** `pnpm test` — `packages/db` already has a Vitest config and DB tests (`packages/db/__tests__/`). A new test under `packages/db/__tests__/lock_profiles_email.test.ts` should assert: (a) after applying migrations against a local DB, a non-admin user **cannot** update their own `profiles.email` (RLS rejects it); (b) a non-admin user **cannot** update their own `profiles.role` (preserved); (c) a non-admin user **can** still update their own `profiles.display_name`; (d) the migration creates no trigger and no function and promotes no profile; (e) `profiles.email` has a `UNIQUE` constraint and inserting/updating a profile to a duplicate email fails with a unique violation; (f) the reconcile step repairs a `profiles.email` that has been drifted away from its matching `auth.users.email`, and leaves a row whose email already matches unchanged. The test must be non-destructive and re-runnable (per the round-1/round-2 MEDIUM findings) — `test-author` writes the failing test first.
3. **Migration applies cleanly:** run `supabase db reset` (or `supabase migration up`) against the local DB and confirm the new migration applies with no error (the reconcile `update`, `alter table ... add constraint`, `drop policy` / `create policy`).
4. **Reconcile-step check (email repaired):** as service-role (bypassing RLS), drift a profile's `email` away from its matching `auth.users.email` *before* applying the migration (or simulate against a fresh DB), apply the migration, then confirm that profile's `profiles.email` now equals its `auth.users.email`; also confirm a profile whose email already matched is left byte-identical.
5. **Escalation-vector check (email pinned):** as a regular non-admin user, attempt to `UPDATE public.profiles SET email = 'attacker-target@example.com' WHERE id = auth.uid()` → expect the RLS `WITH CHECK` to reject it.
6. **Role still pinned:** as a regular non-admin user, attempt to `UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid()` → expect the RLS `WITH CHECK` to reject it.
7. **display_name still editable:** as a regular non-admin user, `UPDATE public.profiles SET display_name = 'Renamed' WHERE id = auth.uid()` → expect success (the policy does not block non-`role`/non-`email` fields).
8. **Unique constraint:** confirm `profiles_email_key` exists on `public.profiles`, and (as service-role, bypassing RLS) attempt to set one profile's `email` to another profile's `email` → expect a unique-violation error.
9. **No automatic promotion:** confirm the migration introduced no trigger and no function on `public.profiles`, and that applying it against a DB where `sspataro@gmail.com` has signed up leaves that profile's `role` unchanged at `'user'`.
10. **Operator bootstrap check:** against the local DB, with `sspataro@gmail.com` signed up, run `npx tsx scripts/bootstrap-admin.ts sspataro@gmail.com` from `packages/db` (with `SUPABASE_SERVICE_ROLE_KEY` set) → `select role from public.profiles where email = 'sspataro@gmail.com'` should now be `admin`.
11. **End-to-end manual smoke** (with the local Supabase running and `pnpm dev`, after running the operator bootstrap):
    1. Log in as `sspataro@gmail.com` (now an admin).
    2. Confirm the "Users" link is visible in `NavBar` and `/users` loads without a redirect to `/dashboard`.
    3. Confirm the "+ New User" button renders; open the modal, submit email `new@example.com` / display name `Test User` / password `password123` / role `user`.
    4. Modal closes; the new user appears in the list after revalidation.
    5. Submit again with the same email → human-readable "already registered" error in the modal, no page crash.
12. **Production checklist:** confirm `SUPABASE_SERVICE_ROLE_KEY` is set in the Vercel production environment before announcing the feature as usable in prod (see "Secondary hardening").

## Future work (out of this ticket)

- Replace the `!` non-null assertion on `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/lib/supabase/service.ts` with an explicit configuration check that throws a clear error.
- Seed a deterministic admin in `supabase/seed.sql` for local development so contributors get an admin without running `bootstrap-admin.ts`.
- An "invite via magic link" creation mode (`auth.admin.inviteUserByEmail`) so admins do not have to set and communicate passwords out-of-band.
- An "Edit user" modal (currently only role and `is_active` are mutable inline).
- A self-serve password-reset flow for created users.
- Consider removing `profiles.email` entirely in favor of always joining `auth.users` — the column is duplicative of `auth.users.email` (it is now reconciled, unique, and immutable, but still a mirror).
- Revisit `supabase/config.toml`: disabling open public signup and/or enabling email confirmation would neutralise the first-admin-takeover class of risk and could make a future automatic post-migration promotion path safe to reconsider.
</content>
</invoke>
