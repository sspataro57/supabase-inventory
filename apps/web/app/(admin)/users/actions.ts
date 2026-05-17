"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";

async function requireAdmin() {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (myProfile?.role !== "admin") throw new Error("Forbidden");
  return { supabase, userId: user.id };
}

export async function createUser(formData: FormData) {
  const { supabase, userId } = await requireAdmin();

  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  const password = (formData.get("password") as string) ?? "";
  const displayName = ((formData.get("display_name") as string) ?? "").trim();
  const role = (formData.get("role") as string) ?? "user";

  if (!email) throw new Error("Email is required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (!["admin", "user"].includes(role)) throw new Error("Invalid role");

  // Service-role client: bypasses RLS and can create auth users.
  const admin = createServiceClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(createErr.message);

  const newUserId = created.user!.id;

  // The signup trigger creates the profiles row; set role + display name on it.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role, display_name: displayName || null })
    .eq("id", newUserId);
  if (profileErr) {
    throw new Error(`User created but profile update failed: ${profileErr.message}`);
  }

  await writeAudit(supabase, {
    actorId: userId,
    action: "user.create",
    entityType: "profile",
    entityId: newUserId,
    after: { email, role },
  });

  revalidatePath("/users");
}

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
