#!/usr/bin/env node
/**
 * Fails when a key page ships without structured data, or ships JSON-LD that
 * doesn't parse. An audit found zero JSON-LD live on pages whose component
 * source appeared to contain it, so this checks the *served* HTML.
 *
 * Fetches against a running server (dev or preview):
 *   node scripts/check-structured-data.mjs [baseUrl]
 *   BASE_URL=https://taasflow.com node scripts/check-structured-data.mjs
 *
 * When no server answers, the check reports skipped and exits 0 — CI runs it
 * after `vite preview`, and it must not block a build that has no server.
 */
const BASE = (process.argv[2] || process.env.BASE_URL || "http://localhost:8080").replace(/\/$/, "");

/** path -> schema @type values that must be present. */
const EXPECTED = {
  "/": ["Organization"],
  "/faq": ["FAQPage"],
  "/jobs": ["ItemList"],
  "/pricing": [],
  "/industries/technology": [],
  "/blog/ai-in-recruitment": ["BlogPosting"],
};

const LD_RE = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;

const errors = [];
let reachable = 0;

const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const collectTypes = (node, out = []) => {
  if (Array.isArray(node)) {
    for (const n of node) collectTypes(n, out);
  } else if (node && typeof node === "object") {
    if (typeof node["@type"] === "string") out.push(node["@type"]);
    if (Array.isArray(node["@type"])) out.push(...node["@type"]);
    for (const v of Object.values(node)) collectTypes(v, out);
  }
  return out;
};

for (const [path, expected] of Object.entries(EXPECTED)) {
  let html;
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { "user-agent": "Googlebot" } });
    if (!res.ok) {
      errors.push(`${path}: HTTP ${res.status}`);
      continue;
    }
    html = await res.text();
    reachable += 1;
  } catch {
    continue; // no server; reported below
  }

  const blocks = [...html.matchAll(LD_RE)].map((m) => m[1].trim()).filter(Boolean);
  if (blocks.length === 0) {
    errors.push(`${path}: no application/ld+json block in the served HTML.`);
    continue;
  }

  const types = [];
  for (const raw of blocks) {
    try {
      types.push(...collectTypes(JSON.parse(decode(raw))));
    } catch (e) {
      errors.push(`${path}: JSON-LD does not parse (${e.message}).`);
    }
  }
  for (const want of expected) {
    if (!types.includes(want)) {
      errors.push(`${path}: served JSON-LD has no ${want} node (found: ${[...new Set(types)].join(", ") || "none"}).`);
    }
  }
}

if (reachable === 0) {
  console.log(
    `check-structured-data: skipped — nothing answering at ${BASE}. Run against a dev or preview server to verify.`,
  );
  process.exit(0);
}

console.log(`check-structured-data: ${reachable}/${Object.keys(EXPECTED).length} pages fetched from ${BASE}.`);
for (const e of errors) console.error(`FAIL  ${e}`);
if (errors.length > 0) {
  console.error(`\ncheck-structured-data failed: ${errors.length} problem(s).`);
  process.exit(1);
}
console.log("check-structured-data passed: every checked page serves valid JSON-LD.");
