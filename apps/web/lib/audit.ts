import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAudit(
  supabase: SupabaseClient,
  opts: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  }
) {
  const diff =
    opts.before !== undefined || opts.after !== undefined
      ? { before: opts.before ?? null, after: opts.after ?? null }
      : null;

  await supabase.from("audit_log").insert({
    actor_id: opts.actorId,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    diff,
  });
}
