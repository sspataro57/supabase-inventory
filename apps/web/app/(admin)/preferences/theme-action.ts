"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setTheme(theme: "light" | "dark" | "system") {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return;

  await supabase.from("profiles").update({ theme }).eq("id", user.id);

  const cookieStore = await cookies();
  if (theme === "system") {
    cookieStore.delete("th");
  } else {
    cookieStore.set("th", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  revalidatePath("/", "layout");
}
