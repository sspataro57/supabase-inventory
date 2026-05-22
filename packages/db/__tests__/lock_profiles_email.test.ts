/**
 * OpenProject #93 — Lock profiles.email against self-service mutation
 * DB integration tests against the local Supabase instance (service-role client).
 *
 * Migration contract encoded (20260522000000_lock_profiles_email.sql):
 *
 *   The migration does THREE things, in order:
 *
 *   A. RECONCILE: repairs profiles.email from auth.users.email so any row a user
 *      previously rewrote (before this lock existed) is restored to its true
 *      identity.  This runs first so that any tampered/drifted rows are fixed
 *      before the UNIQUE constraint (step B) is applied.
 *
 *      update public.profiles p set email = u.email
 *        from auth.users u
 *       where p.id = u.id and u.email is not null and p.email is distinct from u.email;
 *
 *   B. Adds a UNIQUE constraint (profiles_email_key) on public.profiles.email.
 *      profiles.email mirrors auth.users.email (copied by handle_new_user() at
 *      signup). auth.users.email is already unique; this constraint propagates
 *      that invariant to the profiles mirror and makes bootstrap-admin.ts safe:
 *      `update ... where email = ?` can no longer match more than one row.
 *
 *   C. Replaces the profiles_update_self RLS policy with a version that adds
 *      an email pin to its WITH CHECK clause. The policy was previously missing
 *      the email pin, meaning a user could rewrite their own profiles.email to
 *      any address. profiles.email is set once by handle_new_user() at signup
 *      and has no legitimate self-service update path. This migration closes that
 *      gap by pinning email to its current DB value on every self-UPDATE.
 *
 *   Contract 1 — email pin (RLS):
 *     A regular authenticated user CANNOT change their own profiles.email via
 *     the PostgREST API. The new WITH CHECK `email = (select email ...)` pin
 *     rejects the mutation silently (0 rows affected — RLS WITH CHECK violations
 *     exclude the row, they do not return an error).
 *
 *   Contract 2 — display_name still editable:
 *     The same user CAN still change their own profiles.display_name. The
 *     tightened policy must not be over-restrictive on benign self-updates.
 *
 *   Contract 3 — role pin preserved:
 *     The rewritten policy still prevents a user from changing their own
 *     profiles.role (the pre-existing role pin from the original policy is
 *     preserved in the new policy). This ensures the rewrite did not regress it.
 *
 *   Contract 4 — structural guard (no auto-promotion artefacts):
 *     Neither the promote_bootstrap_admin trigger nor its backing function exist
 *     in the database. This is a cheap regression guard ensuring that an
 *     auto-promotion design that was explicitly rejected cannot silently re-enter
 *     the schema.
 *
 *   Contract 5 — profiles.email uniqueness (UNIQUE constraint):
 *     5a. Structural: the constraint profiles_email_key (type UNIQUE) exists on
 *         public.profiles.
 *     5b. Behavioral: a service-role UPDATE that sets one profile's email to
 *         another profile's existing email is rejected by Postgres with a
 *         unique-violation error (SQLSTATE 23505, constraint profiles_email_key).
 *         Service-role is used to bypass RLS so the test isolates the UNIQUE
 *         constraint rather than the RLS policy.
 *
 *   Contract 6 — reconciliation step (step 1 of the migration):
 *     RECONCILE_SQL repairs a profiles.email that has drifted from auth.users.email
 *     (e.g. tampered before this lock existed) and leaves already-correct rows
 *     untouched (idempotent / no-op on rows where profiles.email already matches
 *     auth.users.email).
 *
 * Pre-requisites:
 *   - Local Supabase must be running (`pnpm supabase start`).
 *   - Migration `20260522000000_lock_profiles_email.sql` must be applied.
 *
 * Run:
 *   pnpm --filter @inventory/db test
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "child_process";
import ws from "ws";

// ── Local Supabase credentials (standard local dev values — never production) ──
const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Postgres direct access (from `supabase status` — local dev only).
const PG_HOST = "127.0.0.1";
const PG_PORT = "5436";
const PG_USER = "postgres";
const PG_PASS = "postgres";
const PG_DB = "postgres";

// Unique run ID so test rows don't collide across parallel runs.
const RUN_ID = Math.random().toString(36).slice(2, 8).toUpperCase();

let db: SupabaseClient;

// ── IDs of rows we create during tests, for cleanup ──────────────────────────
const cleanupUserIds: string[] = [];

// ── The exact step-1 SQL from the migration (reconcile profiles.email from
//    auth.users.email). Kept here verbatim so the test encodes the same
//    contract as the migration without duplicating business logic.
const RECONCILE_SQL =
  `update public.profiles p set email = u.email ` +
  `from auth.users u ` +
  `where p.id = u.id and u.email is not null and p.email is distinct from u.email;`;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Run a SQL statement via psql using spawnSync (avoids shell-quoting issues).
 * Returns stdout as a trimmed string.
 */
function psql(sql: string): string {
  const result = spawnSync(
    "psql",
    [
      "-h", PG_HOST,
      "-p", PG_PORT,
      "-U", PG_USER,
      "-d", PG_DB,
      "-t",   // tuples only
      "-A",   // unaligned output
      "-c", sql,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: PG_PASS },
    }
  );

  if (result.error) throw new Error(`psql spawn failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`psql exited ${result.status}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/**
 * Like psql() but passes VERBOSITY=verbose so Postgres includes the SQLSTATE
 * code (e.g. "23505:") in the error message. Used to assert specific error
 * codes in tests that expect a failure.
 * Throws with the stderr message (including SQLSTATE) on non-zero exit.
 */
function psqlVerbose(sql: string): string {
  const result = spawnSync(
    "psql",
    [
      "-h", PG_HOST,
      "-p", PG_PORT,
      "-U", PG_USER,
      "-d", PG_DB,
      "-t",   // tuples only
      "-A",   // unaligned output
      "-v", "VERBOSITY=verbose",
      "-c", sql,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: PG_PASS },
    }
  );

  if (result.error) throw new Error(`psql spawn failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`psql exited ${result.status}: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/**
 * Insert a row directly into auth.users (bypassing GoTrue) and return the
 * generated UUID. The signup trigger (handle_new_user) creates the matching
 * profiles row at role='user'.
 */
function createTestAuthUser(email: string): string {
  const sql =
    `INSERT INTO auth.users ` +
    `(id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at) ` +
    `VALUES (gen_random_uuid(), '${email}', '', now(), 'authenticated', 'authenticated', now(), now()) ` +
    `RETURNING id;`;

  const output = psql(sql);
  const uuidLine = output
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^[0-9a-f-]{36}$/.test(l));

  if (!uuidLine) {
    throw new Error(
      `createTestAuthUser: could not parse UUID from psql output: "${output}"`
    );
  }
  return uuidLine;
}

/**
 * Create a real GoTrue user (with a password) via the admin API, so the user
 * can sign in via signInWithPassword. Returns the user's UUID.
 * The handle_new_user trigger creates the matching profiles row automatically.
 */
async function createSignableTestUser(email: string, password: string): Promise<string> {
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`createSignableTestUser failed for '${email}': ${error?.message}`);
  }
  return data.user.id;
}

function deleteTestAuthUser(userId: string): void {
  psql(`DELETE FROM auth.users WHERE id = '${userId}';`);
}

// ── Test lifecycle ─────────────────────────────────────────────────────────────

beforeAll(() => {
  db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}, 15_000);

afterAll(async () => {
  if (!db) return;

  for (const userId of cleanupUserIds) {
    await db.from("profiles").delete().eq("id", userId);
    deleteTestAuthUser(userId);
  }
}, 30_000);

// ═════════════════════════════════════════════════════════════════════════════
// Contract 1 — email pin: a regular user cannot change their own profiles.email.
// Contract 2 — display_name remains editable: the policy is not over-restrictive.
// Contract 3 — role pin preserved: the rewritten policy still blocks role changes.
//
// All three contracts are tested via a real signed-in user-scoped client
// (anon key + signInWithPassword) so the JWT carries the correct auth.uid().
// ═════════════════════════════════════════════════════════════════════════════

describe("lock_profiles_email — RLS policy contracts", () => {
  let rlsTestUserId: string;
  const rlsTestEmail = `rls-email-pin-t93-${RUN_ID.toLowerCase()}@test.local`;
  const rlsTestPassword = `test-pw-${RUN_ID}`;
  let userClient: SupabaseClient;

  beforeAll(async () => {
    // Create a GoTrue user with a password so we can sign in and obtain a real JWT.
    rlsTestUserId = await createSignableTestUser(rlsTestEmail, rlsTestPassword);
    cleanupUserIds.push(rlsTestUserId);

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
      realtime: { transport: ws as unknown as typeof WebSocket },
    });

    const { data: session, error: signInError } = await anonClient.auth.signInWithPassword({
      email: rlsTestEmail,
      password: rlsTestPassword,
    });

    if (signInError || !session.session) {
      throw new Error(
        `RLS test setup: could not sign in as '${rlsTestEmail}': ${signInError?.message}`
      );
    }

    // Build a user-scoped client using the access token from the session.
    userClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: { transport: ws as unknown as typeof WebSocket },
      global: {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      },
    });
  }, 30_000);

  // ── Contract 1 ──────────────────────────────────────────────────────────────

  it("a regular user cannot change their own profiles.email (RLS WITH CHECK email pin rejects the mutation)", async () => {
    // The profiles_update_self WITH CHECK now requires:
    //   email = (select email from profiles where id = auth.uid())
    // Writing a different email value causes the row to fail WITH CHECK and be
    // excluded from the UPDATE — 0 rows affected, no error returned by PostgREST.
    const differentEmail = `changed-${RUN_ID.toLowerCase()}@attacker.local`;

    const { data, error } = await userClient
      .from("profiles")
      .update({ email: differentEmail })
      .eq("id", rlsTestUserId)
      .select("email");

    // A PostgREST error is also acceptable (some RLS configurations raise rather
    // than silently exclude). Either way the mutation must not have persisted.
    if (error) {
      // Error path — mutation blocked. Pass.
      return;
    }

    // No error — the update was silently excluded; data should be empty.
    const updatedRows = (data ?? []) as Array<{ email: string }>;
    const anyMutated = updatedRows.some((r) => r.email === differentEmail);

    expect(
      anyMutated,
      `RLS must block a user from changing profiles.email to '${differentEmail}', ` +
      `but the update returned rows with the new email value.`
    ).toBe(false);

    // Confirm the DB value is still the original email.
    const currentEmail = psql(
      `SELECT email FROM public.profiles WHERE id = '${rlsTestUserId}';`
    ).trim();

    expect(
      currentEmail,
      `After the blocked email update, profiles.email must still be '${rlsTestEmail}' ` +
      `(id=${rlsTestUserId}), but the DB shows '${currentEmail}'.`
    ).toBe(rlsTestEmail);
  });

  // ── Contract 2 ──────────────────────────────────────────────────────────────

  it("a regular user CAN change their own profiles.display_name (policy is not over-restrictive)", async () => {
    const newDisplayName = `RLS-Test-${RUN_ID}`;

    const { error } = await userClient
      .from("profiles")
      .update({ display_name: newDisplayName })
      .eq("id", rlsTestUserId);

    expect(
      error,
      `A regular user must be able to update their own display_name, but got error: ${error?.message}`
    ).toBeNull();

    // Verify the update actually persisted in the DB.
    const storedName = psql(
      `SELECT display_name FROM public.profiles WHERE id = '${rlsTestUserId}';`
    ).trim();

    expect(
      storedName,
      `After updating display_name to '${newDisplayName}', the DB must reflect the change ` +
      `but shows '${storedName}'.`
    ).toBe(newDisplayName);
  });

  // ── Contract 3 ──────────────────────────────────────────────────────────────

  it("a regular user cannot change their own profiles.role (pre-existing role pin is preserved in the rewritten policy)", async () => {
    // The new policy keeps the role pin:
    //   role = (select role from profiles where id = auth.uid())
    // Attempting to self-promote to 'admin' must be silently blocked.
    const { data, error } = await userClient
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", rlsTestUserId)
      .select("role");

    if (error) {
      // Error path — mutation blocked. Pass.
      return;
    }

    const updatedRows = (data ?? []) as Array<{ role: string }>;
    const anyPromoted = updatedRows.some((r) => r.role === "admin");

    expect(
      anyPromoted,
      `RLS must block a user from self-promoting profiles.role to 'admin', ` +
      `but the update returned rows with role='admin'.`
    ).toBe(false);

    // Confirm the DB value is still 'user'.
    const currentRole = psql(
      `SELECT role FROM public.profiles WHERE id = '${rlsTestUserId}';`
    ).trim();

    expect(
      currentRole,
      `After the blocked role update, profiles.role must still be 'user' ` +
      `(id=${rlsTestUserId}), but the DB shows '${currentRole}'.`
    ).toBe("user");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Contract 4 — structural guard: no auto-promotion artefacts exist.
//
// The promote_bootstrap_admin trigger and its backing function were explicitly
// rejected during the design of #93 (auto-promotion via email on signup is a
// takeover vector). This contract confirms neither artefact is present in the
// schema — a cheap regression guard that fires immediately if the rejected
// design ever sneaks back in.
// ═════════════════════════════════════════════════════════════════════════════

describe("lock_profiles_email — structural guard: no auto-promotion artefacts", () => {
  let bystanderUserId: string;
  const bystanderEmail = `bystander-t93-${RUN_ID.toLowerCase()}@test.local`;

  beforeAll(() => {
    // Insert a new auth.users row (fires handle_new_user) to exercise the signup
    // path. If a promote_bootstrap_admin trigger were present, this insert would
    // trigger it. The structural tests below verify it cannot exist.
    bystanderUserId = createTestAuthUser(bystanderEmail);
    cleanupUserIds.push(bystanderUserId);
  }, 15_000);

  it("promote_bootstrap_admin trigger does not exist on public.profiles", () => {
    const triggerCount = psql(
      `SELECT count(*) FROM pg_trigger ` +
      `JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid ` +
      `JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid ` +
      `WHERE pg_namespace.nspname = 'public' ` +
      `  AND pg_class.relname = 'profiles' ` +
      `  AND pg_trigger.tgname = 'promote_bootstrap_admin';`
    ).trim();

    expect(
      Number(triggerCount),
      `The promote_bootstrap_admin BEFORE INSERT trigger must NOT exist on public.profiles. ` +
      `Found ${triggerCount} trigger(s). The auto-promotion takeover vector has been re-introduced.`
    ).toBe(0);
  });

  it("promote_bootstrap_admin function does not exist in the public schema", () => {
    const funcCount = psql(
      `SELECT count(*) FROM pg_proc ` +
      `JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid ` +
      `WHERE pg_namespace.nspname = 'public' ` +
      `  AND pg_proc.proname = 'promote_bootstrap_admin';`
    ).trim();

    expect(
      Number(funcCount),
      `The promote_bootstrap_admin function must NOT exist in the public schema. ` +
      `Found ${funcCount} function(s). The rejected auto-promotion design has been re-introduced.`
    ).toBe(0);
  });

  it("a new signup (handle_new_user path) produces role='user', not 'admin' — no auto-promotion fires", async () => {
    // bystanderUserId was inserted in beforeAll via createTestAuthUser, which
    // fires handle_new_user(). Without a promote_bootstrap_admin trigger the
    // resulting profiles row must always be role='user'.
    const { data, error } = await db
      .from("profiles")
      .select("role")
      .eq("id", bystanderUserId)
      .single();

    expect(error).toBeNull();
    expect(
      (data as { role: string }).role,
      `A new signup (handle_new_user path) must result in role='user', not 'admin'. ` +
      `Got role='${(data as { role: string })?.role}' for id=${bystanderUserId} (email=${bystanderEmail}). ` +
      `If 'admin', a BEFORE INSERT trigger has been re-added and the auto-promotion vector is open.`
    ).toBe("user");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Contract 5 — profiles.email uniqueness (UNIQUE constraint).
//
// The migration adds `profiles_email_key unique (email)` on public.profiles.
// profiles.email mirrors auth.users.email (which is already unique); this
// constraint propagates that invariant to the profiles mirror and makes
// bootstrap-admin.ts safe: `update ... where email = ?` can never promote
// more than one row.
//
// 5a (structural): information_schema.table_constraints confirms a UNIQUE
//    constraint named profiles_email_key exists on public.profiles.
//
// 5b (behavioral): a service-role UPDATE that attempts to set one profile's
//    email to another profile's existing email is rejected by Postgres with
//    SQLSTATE 23505 (unique_violation) citing profiles_email_key. Service-role
//    is used deliberately to bypass RLS — without it, the email pin in the
//    profiles_update_self WITH CHECK would also block the mutation for a
//    different reason, making the assertion ambiguous. Running as superuser
//    removes RLS from the picture and proves the constraint itself rejects
//    the duplicate.
// ═════════════════════════════════════════════════════════════════════════════

describe("lock_profiles_email — UNIQUE constraint on profiles.email", () => {
  let userAlphaId: string;
  let userBetaId: string;
  const alphaEmail = `uniq-alpha-t93-${RUN_ID.toLowerCase()}@test.local`;
  const betaEmail  = `uniq-beta-t93-${RUN_ID.toLowerCase()}@test.local`;

  beforeAll(() => {
    // Create two distinct auth users (fires handle_new_user for each),
    // producing two profiles rows with different emails.
    userAlphaId = createTestAuthUser(alphaEmail);
    userBetaId  = createTestAuthUser(betaEmail);
    cleanupUserIds.push(userAlphaId, userBetaId);
  }, 15_000);

  // ── Contract 5a — structural ─────────────────────────────────────────────

  it("profiles_email_key UNIQUE constraint exists on public.profiles (structural check)", () => {
    const count = psql(
      `SELECT count(*) ` +
      `FROM information_schema.table_constraints ` +
      `WHERE constraint_schema = 'public' ` +
      `  AND table_name        = 'profiles' ` +
      `  AND constraint_name   = 'profiles_email_key' ` +
      `  AND constraint_type   = 'UNIQUE';`
    ).trim();

    expect(
      Number(count),
      `Expected a UNIQUE constraint named 'profiles_email_key' on public.profiles ` +
      `(migration 20260522000000_lock_profiles_email.sql), but information_schema reports ${count} matching constraint(s). ` +
      `Run 'supabase db reset' to re-apply migrations.`
    ).toBe(1);
  });

  // ── Contract 5b — behavioral ─────────────────────────────────────────────

  it("a service-role UPDATE that sets profiles.email to a duplicate value is rejected with SQLSTATE 23505 (unique_violation)", () => {
    // Attempt to overwrite beta's email with alpha's email via the postgres
    // superuser (bypasses RLS entirely). The UNIQUE constraint must reject this.
    //
    // psqlVerbose() passes VERBOSITY=verbose so Postgres emits "23505:" at the
    // start of the ERROR line, making the SQLSTATE machine-checkable.
    //
    // The helper throws on non-zero psql exit, so we wrap in try/catch and
    // assert on the thrown message.
    let threw = false;
    let errorMessage = "";

    try {
      psqlVerbose(
        `UPDATE public.profiles ` +
        `SET email = '${alphaEmail}' ` +
        `WHERE id = '${userBetaId}';`
      );
    } catch (err) {
      threw = true;
      errorMessage = (err as Error).message;
    }

    expect(
      threw,
      `Expected the duplicate-email UPDATE to throw (psql non-zero exit), ` +
      `but psqlVerbose() returned without error. ` +
      `The profiles_email_key UNIQUE constraint may be missing or not enforced. ` +
      `(alpha id=${userAlphaId} email=${alphaEmail}, beta id=${userBetaId} email=${betaEmail})`
    ).toBe(true);

    // VERBOSITY=verbose makes Postgres prefix ERROR lines with "SQLSTATE: message",
    // e.g. "ERROR:  23505: duplicate key value violates unique constraint ..."
    expect(
      errorMessage,
      `Expected the psql error message to contain SQLSTATE '23505' (unique_violation), ` +
      `but got: ${errorMessage}`
    ).toContain("23505");

    expect(
      errorMessage,
      `Expected the psql error message to cite the constraint name 'profiles_email_key', ` +
      `but got: ${errorMessage}`
    ).toContain("profiles_email_key");

    // Belt-and-suspenders: confirm beta's email is still betaEmail in the DB.
    const storedEmail = psql(
      `SELECT email FROM public.profiles WHERE id = '${userBetaId}';`
    ).trim();

    expect(
      storedEmail,
      `After the rejected duplicate UPDATE, profiles.email for beta (id=${userBetaId}) ` +
      `must still be '${betaEmail}', but the DB shows '${storedEmail}'.`
    ).toBe(betaEmail);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Contract 6 — reconciliation step (RECONCILE_SQL, step 1 of the migration).
//
// Before the UNIQUE constraint or RLS email-pin existed, a user could freely
// rewrite their own profiles.email to any value, causing it to drift from the
// true identity stored in auth.users.email. The migration's step-1 UPDATE
// repairs any such drifted rows by resetting profiles.email to the matching
// auth.users.email value. It must also be idempotent: rows where
// profiles.email already matches auth.users.email must be left unchanged.
//
// 6a (repair): a profile whose email was poisoned / drifted before the lock
//    existed is restored to the auth.users.email value after RECONCILE_SQL runs.
//
// 6b (idempotent / no-op): a profile whose email already matches
//    auth.users.email is left untouched by RECONCILE_SQL.
// ═════════════════════════════════════════════════════════════════════════════

describe("lock_profiles_email — reconciliation step repairs drifted profiles.email", () => {
  // Two users: one whose profile email will be poisoned (drift), one left intact.
  let driftedUserId: string;
  let intactUserId: string;

  // The emails stored in auth.users (the source of truth).
  const driftedAuthEmail = `reconcile-drifted-t93-${RUN_ID.toLowerCase()}@test.local`;
  const intactAuthEmail  = `reconcile-intact-t93-${RUN_ID.toLowerCase()}@test.local`;

  // A deliberately different email value — unique so it does not collide with
  // any other profiles row (the UNIQUE constraint is live).
  const poisonedEmail = `poisoned-before-lock-t93-${RUN_ID.toLowerCase()}@evil.local`;

  beforeAll(() => {
    // createTestAuthUser fires handle_new_user(), which copies auth.users.email
    // into profiles.email. So immediately after creation both rows are clean.
    driftedUserId = createTestAuthUser(driftedAuthEmail);
    intactUserId  = createTestAuthUser(intactAuthEmail);
    cleanupUserIds.push(driftedUserId, intactUserId);

    // Simulate drift on the drifted user: directly UPDATE profiles.email via
    // the postgres superuser (bypasses the RLS email pin that was just added
    // — exactly what could happen to pre-existing rows created before this
    // migration shipped). Use a unique poisonedEmail to avoid a UNIQUE conflict.
    psql(
      `UPDATE public.profiles SET email = '${poisonedEmail}' ` +
      `WHERE id = '${driftedUserId}';`
    );

    // Sanity-check: confirm the drift is in place before running RECONCILE_SQL.
    const emailBeforeReconcile = psql(
      `SELECT email FROM public.profiles WHERE id = '${driftedUserId}';`
    ).trim();

    if (emailBeforeReconcile !== poisonedEmail) {
      throw new Error(
        `reconcile test setup: expected drifted profile to have email '${poisonedEmail}' ` +
        `before reconcile, but found '${emailBeforeReconcile}'.`
      );
    }
  }, 15_000);

  // ── Contract 6a — drift is repaired ─────────────────────────────────────

  it("RECONCILE_SQL repairs a drifted profiles.email row back to the auth.users.email value", () => {
    // Run the exact step-1 SQL from the migration.
    psql(RECONCILE_SQL);

    const repairedEmail = psql(
      `SELECT email FROM public.profiles WHERE id = '${driftedUserId}';`
    ).trim();

    expect(
      repairedEmail,
      `After RECONCILE_SQL, profiles.email for id=${driftedUserId} must be restored ` +
      `to the auth.users.email value '${driftedAuthEmail}', ` +
      `but the DB shows '${repairedEmail}'. ` +
      `The reconciliation UPDATE did not repair the drifted row.`
    ).toBe(driftedAuthEmail);
  });

  // ── Contract 6b — already-correct rows are left untouched (idempotent) ───

  it("RECONCILE_SQL is a no-op on a profiles row whose email already matches auth.users.email", () => {
    // Record the email before a second run of RECONCILE_SQL.
    const emailBeforeSecondRun = psql(
      `SELECT email FROM public.profiles WHERE id = '${intactUserId}';`
    ).trim();

    // The intact user's profile should already equal the auth email.
    expect(
      emailBeforeSecondRun,
      `Precondition: intact user's profiles.email should already be '${intactAuthEmail}' ` +
      `(set by handle_new_user at signup), but found '${emailBeforeSecondRun}'.`
    ).toBe(intactAuthEmail);

    // Run RECONCILE_SQL again (idempotency check).
    psql(RECONCILE_SQL);

    const emailAfterSecondRun = psql(
      `SELECT email FROM public.profiles WHERE id = '${intactUserId}';`
    ).trim();

    expect(
      emailAfterSecondRun,
      `After a second run of RECONCILE_SQL, the intact user's profiles.email must remain ` +
      `'${intactAuthEmail}' (no-op on already-correct row), ` +
      `but the DB shows '${emailAfterSecondRun}'.`
    ).toBe(intactAuthEmail);
  });
});
