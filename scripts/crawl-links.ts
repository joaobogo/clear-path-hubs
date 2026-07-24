#!/usr/bin/env bun
/**
 * Public-site link crawler.
 *
 * Usage:
 *   bun scripts/crawl-links.ts [baseUrl]
 *
 * Defaults to http://localhost:8080 (dev server) if no argument passed.
 *
 * What it does:
 *   - BFS crawl of same-origin pages starting from `/`
 *   - Records every <a href>, extracts the destination
 *   - For internal hrefs: fetches HEAD (falling back to GET) and records status
 *   - Flags placeholder hrefs ("#", "javascript:void(0)")
 *   - Flags internal redirects (3xx) as broken (no chains allowed)
 *   - Writes /tmp/crawl-report.json with { pages, links, broken, placeholders, redirects }
 *
 * PASS criteria (Prompt 45):
 *   broken.length === 0 && placeholders.length === 0 && redirects.length === 0
 */

const base = (process.argv[2] ?? "http://localhost:8080").replace(/\/$/, "");
const origin = new URL(base).origin;

type LinkRow = { from: string; to: string; text: string };
const visited = new Set<string>();
const queue: string[] = ["/"];
const links: LinkRow[] = [];
const placeholders: LinkRow[] = [];
const linkStatus = new Map<string, number>();

function normalize(href: string, from: string): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^(mailto:|tel:|javascript:)/i.test(trimmed)) return trimmed;
  if (trimmed === "#" || trimmed.startsWith("#")) return trimmed;
  try {
    const u = new URL(trimmed, origin + from);
    return u.toString();
  } catch {
    return null;
  }
}

function isInternal(url: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

async function fetchPage(path: string): Promise<string | null> {
  try {
    const res = await fetch(origin + path, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      linkStatus.set(origin + path, res.status);
      return null;
    }
    if (!res.ok) {
      linkStatus.set(origin + path, res.status);
      return null;
    }
    return await res.text();
  } catch {
    linkStatus.set(origin + path, 0);
    return null;
  }
}

const anchorRe =
  /<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;

async function crawl() {
  while (queue.length > 0) {
    const path = queue.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);
    const html = await fetchPage(path);
    if (!html) continue;
    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(html))) {
      const raw = m[2] ?? m[3] ?? "";
      const text = (m[4] ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 80);
      const normalized = normalize(raw, path);
      if (!normalized) continue;
      const row: LinkRow = { from: path, to: normalized, text };
      if (raw === "#" || raw.startsWith("javascript:")) {
        placeholders.push(row);
        continue;
      }
      links.push(row);
      if (isInternal(normalized)) {
        const nextPath = new URL(normalized).pathname;
        if (!visited.has(nextPath) && !queue.includes(nextPath)) queue.push(nextPath);
      }
    }
  }
}

async function verifyLinks() {
  const unique = Array.from(new Set(links.map((l) => l.to)));
  for (const url of unique) {
    if (linkStatus.has(url)) continue;
    if (!isInternal(url)) {
      linkStatus.set(url, 200); // skip external verification
      continue;
    }
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });
      linkStatus.set(url, res.status);
    } catch {
      linkStatus.set(url, 0);
    }
  }
}

await crawl();
await verifyLinks();

const broken: LinkRow[] = [];
const redirects: LinkRow[] = [];
for (const l of links) {
  const s = linkStatus.get(l.to) ?? 0;
  if (isInternal(l.to)) {
    if (s >= 300 && s < 400) redirects.push({ ...l, text: `${l.text} (${s})` });
    else if (s === 0 || s >= 400) broken.push({ ...l, text: `${l.text} (${s})` });
  }
}

const report = {
  base,
  pages: Array.from(visited).sort(),
  linkCount: links.length,
  placeholderCount: placeholders.length,
  brokenCount: broken.length,
  redirectCount: redirects.length,
  placeholders,
  broken,
  redirects,
};

// eslint-disable-next-line no-console
console.log(JSON.stringify(report, null, 2));
await Bun.write("/tmp/crawl-report.json", JSON.stringify(report, null, 2));

const pass =
  broken.length === 0 && placeholders.length === 0 && redirects.length === 0;
// eslint-disable-next-line no-console
console.log(pass ? "\nPASS" : "\nFAIL");
process.exit(pass ? 0 : 1);
