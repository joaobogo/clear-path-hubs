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
  "/blog/ai-in-recruitment": ["Article"],
  "/platform": ["WebApplication"],
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

/** Schema types that must appear on exactly one page (or a stated set of pages). */
const ONLY_ON = { WebApplication: ["/platform"] };

/** Every node in a JSON-LD tree that carries @type or @id, flattened. */
const collectNodes = (node, out = []) => {
  if (Array.isArray(node)) {
    for (const n of node) collectNodes(n, out);
  } else if (node && typeof node === "object") {
    if (node["@type"] || node["@id"]) out.push(node);
    for (const v of Object.values(node)) collectNodes(v, out);
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
  const nodes = [];
  for (const raw of blocks) {
    try {
      const parsed = JSON.parse(decode(raw));
      types.push(...collectTypes(parsed));
      nodes.push(...collectNodes(parsed));
    } catch (e) {
      errors.push(`${path}: JSON-LD does not parse (${e.message}).`);
    }
  }

  // Duplicate definitions: the same @id declared in full more than once. A bare
  // reference such as { "@id": "..." } is fine and is not counted.
  const defined = new Map();
  for (const n of nodes) {
    const id = n["@id"];
    if (typeof id !== "string") continue;
    if (Object.keys(n).filter((k) => k !== "@id").length === 0) continue;
    defined.set(id, (defined.get(id) ?? 0) + 1);
  }
  for (const [id, count] of defined) {
    if (count > 1) errors.push(`${path}: @id ${id} is defined ${count} times in the served JSON-LD.`);
  }
  // One article node per page: Article and BlogPosting together describe the
  // same post twice.
  if (types.includes("Article") && types.includes("BlogPosting")) {
    errors.push(`${path}: both Article and BlogPosting are present; keep one.`);
  }
  const articleCount = types.filter((t) => t === "Article" || t === "BlogPosting").length;
  if (articleCount > 1) errors.push(`${path}: ${articleCount} article nodes in the served JSON-LD; expected at most one.`);
  for (const [type, allowed] of Object.entries(ONLY_ON)) {
    if (types.includes(type) && !allowed.includes(path)) {
      errors.push(`${path}: ${type} is emitted here but is only allowed on ${allowed.join(", ")}.`);
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
