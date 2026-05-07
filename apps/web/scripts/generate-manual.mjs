import { renderToFile } from "@react-pdf/renderer";
import { createElement } from "react";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic import to handle the JSX transform
const { ManualDocument } = await import("../lib/manual/ManualDocument.js");

const generatedAt = new Date().toLocaleDateString("en-US", {
  year: "numeric", month: "long", day: "numeric",
});

const outPath = join(__dirname, "../public/manual.pdf");
await renderToFile(createElement(ManualDocument, { generatedAt }), outPath);
console.log("Written:", outPath);
