#!/usr/bin/env node
/**
 * Fails the build when an internal blog link points at a slug that isn't live.
 *
 * The audit confirmed a link from the About page to a post that 404s, so this
 * guard covers every place a /blog/<slug> URL can be authored: route sources,
 * marketing components and the JSON content files.
 *
 * Category pages (/blog/category/...) and the index are always valid.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(p, "utf8");

/* ---------- the live post set (mirrors blog-catalog.ts) ---------- */

const manifest = read(join(ROOT, "src/lib/marketing/blog-manifest.ts"));
const includedBlock = manifest
  .split("export const INCLUDED_BLOG_SLUGS")[1]
  .split(/\n\]/)[0];
const live = new Set([...includedBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]));

const blogDir = join(ROOT, "src/content/blog");
for (const f of readdirSync(blogDir)) {
  if (!f.endsWith(".json")) continue;
  const post = JSON.parse(read(join(blogDir, f)));
  if (post.industry) live.add(f.replace(/\.json$/, ""));
}

const categorySlugs = new Set(
  [...manifest.matchAll(/BLOG_CATEGORY_SLUGS[\s\S]*?\n\}/g)]
    .flatMap((m) => [...m[0].matchAll(/"([^"]+)"/g)])
    .map((m) => m[1]),
);

/* ---------- walk the sources that can author a blog URL ---------- */

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walk(p);
    } else if (/\.(tsx?|json)$/.test(name)) {
      files.push(p);
    }
  }
})(join(ROOT, "src"));

const broken = new Map(); // slug -> files
for (const file of files) {
  if (file.endsWith("routeTree.gen.ts")) continue;
  const src = read(file);
  for (const m of src.matchAll(/\/blog\/([a-z0-9][a-z0-9-]{2,})/gi)) {
    const slug = m[1].toLowerCase();
    if (slug === "category" || slug === "index") continue;
    if (live.has(slug) || categorySlugs.has(slug)) continue;
    // Template expressions like /blog/${slug} are resolved at runtime.
    if (slug.startsWith("$")) continue;
    const rel = file.slice(ROOT.length + 1);
    broken.set(slug, [...new Set([...(broken.get(slug) ?? []), rel])]);
  }
}

console.log(
  `check-internal-links: ${live.size} live posts, ${files.length} source files scanned.`,
);

if (broken.size > 0) {
  for (const [slug, where] of [...broken].sort()) {
    console.error(
      `FAIL  /blog/${slug} is not a live post. Linked from: ${where.slice(0, 5).join(", ")}${where.length > 5 ? ` (+${where.length - 5} more)` : ""}`,
    );
  }
  console.error(
    `\ncheck-internal-links failed: ${broken.size} broken internal blog link target(s). Point them at a live post or a /blog/category/... page.`,
  );
  process.exit(1);
}
console.log("check-internal-links passed: every internal blog link resolves.");
