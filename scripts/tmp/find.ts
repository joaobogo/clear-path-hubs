/**
 * Read-only helper: renders a dossier CV through the product PDF + extractor
 * path and prints every whole-word occurrence of the given terms in context.
 *
 * Usage: bun run scripts/tmp/find.ts <slug> term1 term2 ...
 */
import { renderCvPdf } from "../seed-northwind-demo/cv-pdf";

async function main() {
  const [slug, ...terms] = process.argv.slice(2);
  const mod = await import(`../seed-northwind-demo/candidates/${slug}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = ((mod as any).dossier ?? (mod as any).default);
  const { extractCvText } = await import("../../src/lib/cv-extractor.server");
  const { findTermMatches, isNegatedMention } = await import("../../src/lib/scoring-engine.server");
  const pdf = await renderCvPdf(d.cv);
  const text = (await extractCvText(new Uint8Array(pdf), "application/pdf", `${slug}.pdf`)).text;
  for (const t of terms) {
    const hits = findTermMatches(text, t, 20);
    console.log(`\n"${t}" — ${hits.length} hit(s)`);
    for (const h of hits) {
      const ctx = text.slice(Math.max(0, h - 60), h + t.length + 60).replace(/\s+/g, " ");
      console.log(`  @${h}${isNegatedMention(text, h) ? " [negated]" : ""}: …${ctx}…`);
    }
  }
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
