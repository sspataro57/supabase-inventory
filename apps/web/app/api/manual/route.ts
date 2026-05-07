import { createClient } from "@/lib/supabase/server";
import { ManualDocument } from "@/lib/manual/ManualDocument";
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToBuffer } = require("@react-pdf/renderer") as {
  renderToBuffer: (el: unknown) => Promise<Buffer>;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return new Response("Unauthorized", { status: 401 });

  const generatedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const element = React.createElement(ManualDocument, { generatedAt });
  const buffer = await renderToBuffer(element);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="inventory-manual.pdf"',
    },
  });
}
