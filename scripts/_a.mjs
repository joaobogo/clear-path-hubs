import fs from "node:fs";
const { extractText, getDocumentProxy } = await import("../node_modules/unpdf/dist/index.mjs");
const buf = fs.readFileSync("C:/Users/bmadu/Downloads/TaaSFlow_Audit6_Report.pdf");
const pdf = await getDocumentProxy(new Uint8Array(buf));
const { text } = await extractText(pdf, { mergePages: true });
const t = text.replace(/\s+/g, " ");
for (const id of process.argv.slice(2)) {
  const i = t.indexOf(id + " —");
  console.log("\n===== " + id + "\n" + (i < 0 ? "NOT FOUND" : t.slice(i, i + 1400)));
}
