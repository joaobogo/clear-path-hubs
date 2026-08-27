/**
 * Writes public/llms.txt, public/llms-full.txt and public/ai.txt from the
 * single business-facts source (src/lib/seo/ai-facts.ts) at build time, so the
 * machine-readable description can never drift from the pricing constants.
 *
 * llms-full.txt carries the plain-text body of the canonical pages, extracted
 * from the route sources — text the site already publishes, nothing invented.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { AI_FACTS, buildAiTxt, buildLlmsTxt } from "@/lib/seo/ai-facts";

writeFileSync("public/llms.txt", buildLlmsTxt());
writeFileSync("public/ai.txt", buildAiTxt());

/** Route file candidates for a public path. */
function routeFiles(path: string): string[] {
  const seg = path === "/" ? "index" : path.replace(/^\//, "").replace(/\//g, ".");
  return [`src/routes/${seg}.tsx`, `src/routes/${seg}.index.tsx`];
}

/** Pulls human-readable copy out of a route's JSX string and text literals. */
function extractCopy(source: string): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim();
    // Sentence-like copy only: skip class names, tokens and single words.
    if (t.length < 40) return;
    if (/[{}<>]|className|=>|https?:\/\/|^[a-z-]+:/.test(t)) return;
    if (!/[a-z] [a-z]/i.test(t)) return;
    if (out.includes(t)) return;
    out.push(t);
  };
  for (const m of source.matchAll(/"([^"\\]{40,400})"/g)) push(m[1]);
  for (const m of source.matchAll(/>\s*([^<>{}]{40,400})\s*</g)) push(m[1]);
  return out;
}

const blocks: string[] = [
  `# ${AI_FACTS.name} — full text of canonical pages`,
  "",
  `> ${AI_FACTS.summary}`,
  "",
];

for (const page of AI_FACTS.pages) {
  const file = routeFiles(page.path).find((f) => existsSync(f));
  blocks.push(`## ${page.title} — ${AI_FACTS.origin}${page.path}`, "", page.note, "");
  if (!file) continue;
  const copy = extractCopy(readFileSync(file, "utf8")).slice(0, 40);
  if (copy.length) blocks.push(...copy.map((c) => `- ${c}`), "");
}

writeFileSync("public/llms-full.txt", blocks.join("\n"));
console.log(
  `public/llms.txt, public/llms-full.txt and public/ai.txt generated (${AI_FACTS.pages.length} canonical pages).`,
);
