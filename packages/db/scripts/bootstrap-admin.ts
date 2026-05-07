#!/usr/bin/env npx tsx
/**
 * Usage: npx tsx scripts/bootstrap-admin.ts <email>
 *
 * Promotes an existing user to 'admin' role using the service-role key.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: bootstrap-admin <email>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("email", email)
    .select("id, email, role");

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.error(`No profile found for email: ${email}. Sign up first.`);
    process.exit(1);
  }

  console.log(`✓ ${email} is now admin (id: ${data[0].id})`);
}

main();
