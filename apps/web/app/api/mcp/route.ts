import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient as createUserClient } from "@supabase/supabase-js";
import { handleMCPRequest } from "@/lib/mcp/handler";
import argon2 from "argon2";

const PAT_PREFIX = "inv_pat_";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
  }

  const rawToken = authHeader.slice(7);
  if (!rawToken.startsWith(PAT_PREFIX)) {
    return NextResponse.json({ error: "Invalid token format" }, { status: 401 });
  }

  const prefix = rawToken.slice(0, 16);

  const service = createServiceClient();

  // Lookup by prefix, then verify hash
  const { data: candidates } = await service
    .from("mcp_tokens")
    .select("id, user_id, token_hash, is_revoked")
    .eq("token_prefix", prefix)
    .eq("is_revoked", false);

  let validToken: { id: string; user_id: string } | null = null;
  for (const candidate of candidates ?? []) {
    const valid = await argon2.verify(candidate.token_hash, rawToken);
    if (valid) {
      validToken = candidate;
      break;
    }
  }

  if (!validToken) {
    return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
  }

  // Build user-scoped Supabase client (uses service role but restricts to user's data via RLS workaround)
  // Since PAT bypasses auth.uid(), we use service role and pass user_id explicitly to tools
  const userSupabase = service;

  // Update last_used_at (async, don't await)
  service
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", validToken.id)
    .then(() => {});

  const body = await req.json();

  // Handle batch requests
  const requests = Array.isArray(body) ? body : [body];
  const responses = await Promise.all(
    requests.map((r) => handleMCPRequest(r, userSupabase, validToken!.user_id, null))
  );

  const result = Array.isArray(body) ? responses : responses[0];
  return NextResponse.json(result);
}

// MCP clients also send GET for server-sent events (SSE) — not needed for JSON-RPC over HTTP
export async function GET() {
  return NextResponse.json({ error: "Use POST for MCP requests" }, { status: 405 });
}
