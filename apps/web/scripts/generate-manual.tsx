import { renderToFile } from "@react-pdf/renderer";
import React from "react";
import { ManualDocument } from "../lib/manual/ManualDocument";
import { join } from "path";

async function main() {
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const outPath = join(process.cwd(), "public/manual.pdf");

  await renderToFile(
    React.createElement(ManualDocument, { generatedAt }) as never,
    outPath
  );

  console.log("✓ Written to", outPath);
}

main();
