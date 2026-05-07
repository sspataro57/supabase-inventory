"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";

export async function setUserRole(formData: FormData) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (myProfile?.role !== "admin") throw new Error("Forbidden");

  const targetId = formData.get("user_id") as string;
  const newRole = formData.get("role") as string;

  if (!targetId || !["admin", "user"].includes(newRole)) {
    throw new Error("Invalid input");
  }

  const { data: before } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetId)
    .single();

  await supabase.from("profiles").update({ role: newRole }).eq("id", targetId);

  await writeAudit(supabase, {
    actorId: user.id,
    action: "user.role_change",
    entityType: "profile",
    entityId: targetId,
    before: { role: before?.role },
    after: { role: newRole },
  });

  revalidatePath("/users");
}

export async function setUserActive(formData: FormData) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (myProfile?.role !== "admin") throw new Error("Forbidden");

  const targetId = formData.get("user_id") as string;
  const isActive = formData.get("is_active") === "true";

  await supabase.from("profiles").update({ is_active: isActive }).eq("id", targetId);

  revalidatePath("/users");
}
