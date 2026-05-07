import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Never import in RSCs or expose to the browser.
// Use only in route handlers and edge functions.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
