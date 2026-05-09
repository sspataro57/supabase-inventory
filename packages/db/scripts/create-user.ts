#!/usr/bin/env npx tsx
/**
 * Usage: npx tsx scripts/create-user.ts <email> <password> [admin|user]
 *
 * Creates an auth.users row (email pre-confirmed) with the given password.
 * The signup trigger creates the profiles row; this script then sets the role.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const [, , email, password, roleArg = "user"] = process.argv;
if (!email || !password) {
  console.error("Usage: create-user <email> <password> [admin|user]");
  process.exit(1);
}
if (!["admin", "user"].includes(roleArg)) {
  console.error("Role must be 'admin' or 'user'");
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
  realtime: { transport: ws as never },
});

async function main() {
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    console.error("Error creating user:", createErr.message);
    process.exit(1);
  }

  const userId = created.user!.id;

  const { error: roleErr } = await supabase
    .from("profiles")
    .update({ role: roleArg })
    .eq("id", userId);

  if (roleErr) {
    console.error("User created but role update failed:", roleErr.message);
    process.exit(1);
  }

  console.log(`✓ ${email} created as ${roleArg} (id: ${userId})`);
}

main();
