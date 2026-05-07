"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";

export async function updatePreferences(formData: FormData) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Forbidden");

  const service = createServiceClient();
  const { data: before } = await service.from("preferences").select("*").eq("id", 1).single();

  const updates: Record<string, unknown> = {
    default_unit_mass: formData.get("default_unit_mass") || "g",
    default_unit_volume: formData.get("default_unit_volume") || "ml",
    default_unit_count: formData.get("default_unit_count") || "ea",
    require_lot_per_movement: formData.get("require_lot_per_movement") === "true",
    low_stock_check_enabled: formData.get("low_stock_check_enabled") === "true",
    audit_retention_days: parseInt(formData.get("audit_retention_days") as string ?? "365", 10),
    default_llm_provider: formData.get("default_llm_provider") || "openai",
    default_llm_model: formData.get("default_llm_model") || null,
    chat_daily_message_limit: parseInt(formData.get("chat_daily_message_limit") as string ?? "50", 10),
    updated_by: user.id,
  };

  // API keys: only update if a non-empty value was submitted
  const openaiKey = (formData.get("openai_api_key") as string)?.trim();
  if (openaiKey) updates.openai_api_key = openaiKey;

  const anthropicKey = (formData.get("anthropic_api_key") as string)?.trim();
  if (anthropicKey) updates.anthropic_api_key = anthropicKey;

  const customUrl = (formData.get("custom_llm_url") as string)?.trim();
  updates.custom_llm_url = customUrl || null;

  const customKey = (formData.get("custom_llm_api_key") as string)?.trim();
  if (customKey) updates.custom_llm_api_key = customKey;

  await service.from("preferences").update(updates).eq("id", 1);

  // Audit without the key values
  const { openai_api_key, anthropic_api_key, custom_llm_api_key, ...auditBefore } = before ?? {};
  const { openai_api_key: _a, anthropic_api_key: _b, custom_llm_api_key: _c, ...auditAfter } = updates;
  await writeAudit(supabase, {
    actorId: user.id,
    action: "preferences.update",
    entityType: "preferences",
    entityId: "1",
    before: auditBefore,
    after: auditAfter,
  });

  revalidatePath("/preferences");
}
