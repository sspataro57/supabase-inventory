import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user!.id)
    .single();

  if (profile?.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service.storage.from("imports").download(path);
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(data, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="import-result.csv"`,
    },
  });
}
