"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import argon2 from "argon2";

export async function generateToken(formData: FormData) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Unauthorized");

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Token name is required");

  // Generate raw token: inv_pat_ + 32 random bytes base64url
  const rawBytes = crypto.randomBytes(32);
  const rawToken = `inv_pat_${rawBytes.toString("base64url")}`;
  const prefix = rawToken.slice(0, 16); // "inv_pat_" + 8 chars
  const hash = await argon2.hash(rawToken, { type: argon2.argon2id });

  const service = createServiceClient();
  const { data, error } = await service
    .from("mcp_tokens")
    .insert({ user_id: user.id, name, token_prefix: prefix, token_hash: hash })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/settings/mcp");
  // Return raw token via search params (shown once)
  return { tokenId: data.id, rawToken };
}

export async function revokeToken(formData: FormData) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Unauthorized");

  const tokenId = formData.get("token_id") as string;
  await supabase
    .from("mcp_tokens")
    .update({ is_revoked: true })
    .eq("id", tokenId)
    .eq("user_id", user.id);

  revalidatePath("/settings/mcp");
}
