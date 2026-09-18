/**
 * A bad value in a URL is a bad LINK. It is never a rejected form.
 *
 * `validateSearch` throws when a query parameter does not parse. TanStack wraps
 * that throw as a SearchParamError whose message is the raw zod JSON; the error
 * taxonomy sees the word "validation" inside it and renders the form-submission
 * boundary. The result was pages with no form, and nothing submitted, telling
 * people their submission had been rejected:
 *
 *   /intake/confirmation  "Check your details — Part of the form wasn't
 *                          accepted. Review your answers and try again."
 *   /admin/team           "Some details weren't accepted — One or more fields
 *                          didn't meet the required shape, so nothing was saved."
 *   /admin/messages       "Some details need fixing — The server rejected this
 *                          submission… Reference: TF-…"
 *
 * The `/intake/confirmation` one is customer-facing: a prospect following a
 * stale confirmation link was told their application had been rejected
 * (audit 17 Sep, item 1; same class as audit 16 Sep, finding 10).
 *
 * THE RULE THIS FILE HOLDS: no search FIELD may throw. Three ways to satisfy
 * it — `fallback(schema, value)` (which is `schema.catch(value)`), `z.coerce.*`,
 * or a `.preprocess()` that normalises before parsing. Which adapter wraps the
 * schema is not the point; a `zodValidator()` over raw `z.string().uuid()`
 * still rejects a bad id.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROUTES = join(process.cwd(), "src/routes");

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === "__tests__") continue;
      routeFiles(p, out);
      continue;
    }
    if (entry.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const rel = (p: string) => p.replace(process.cwd(), "").replace(/\\/g, "/").replace(/^\//, "");

/** The text inside the object literal starting at `from`, braces balanced. */
function objectBlockAt(code: string, from: number): string {
  const open = code.indexOf("{", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}") {
      depth -= 1;
      if (depth === 0) return code.slice(open + 1, i);
    }
  }
  return "";
}

/**
 * Search fields in this file that would throw on a value they dislike.
 *
 * Returns [] for a route whose validateSearch is a hand-written function — one
 * that builds an object coerces rather than throws — and for a route with no
 * validateSearch at all.
 */
function throwingFields(code: string): string[] {
  const call = code.match(/validateSearch:\s*(.+)/);
  if (!call) return [];
  const value = call[1]!.trim();

  // A hand-written validator that BUILDS its result cannot throw a zod error.
  // One that calls `.parse()` very much can — that is the same defect wearing
  // a function.
  const isFunction = value.startsWith("(");
  if (isFunction && !/\.parse\(/.test(value)) return [];

  // Locate the schema: `zodValidator(name)`, `(s) => name.parse(s)`,
  // a bare `name`, or an inline `zodValidator(z.object({…`.
  const named = value.match(/(\w+)\.parse\(/) ?? value.match(/^(?:zodValidator\(\s*)?(\w+)/);
  let anchor = -1;
  if (named?.[1] && named[1] !== "z") {
    anchor = code.search(new RegExp(`const\\s+${named[1]}\\s*=\\s*z\\.object\\(`));
  }
  if (anchor < 0) anchor = code.indexOf("z.object(", call.index);
  if (anchor < 0) return [];

  const block = objectBlockAt(code, code.indexOf("z.object(", anchor));

  // Split into top-level `name: expression` entries. A field's value routinely
  // spans several lines (`tab: z\n .preprocess(…)\n .default(…)`), so reading
  // line by line judged `tab: z` and called it unsafe.
  const entries: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of block) {
    if ("({[".includes(ch)) depth += 1;
    else if (")}]".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) {
      entries.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  entries.push(current);

  const offenders: string[] = [];
  for (const entry of entries) {
    const field = entry.match(/^\s*(\w+)\s*:\s*([\s\S]+)$/);
    if (!field) continue;
    const expr = field[2]!.replace(/\s+/g, " ").trim();
    const safe =
      expr.includes("fallback(") || expr.includes("z.coerce") || expr.includes("preprocess");
    if (!safe) offenders.push(`${field[1]}: ${expr.slice(0, 60)}`);
  }
  return offenders;
}

/**
 * Routes still allowed to throw, with the reason. Empty, and meant to stay so.
 *
 * `client.conversations.new` was the last entry: it needs an org and a scope
 * and has nothing to render without them. It now falls back and sends an
 * incomplete link to the conversations list, which is what a broken link
 * deserves — so the exemption was removed rather than left to rot.
 */
const ALLOWED_TO_THROW = new Set<string>([]);

describe("no route rejects a URL the way it rejects a form", () => {
  const files = routeFiles(ROUTES);

  it("finds the route tree", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("no search field anywhere can throw on a bad value", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (ALLOWED_TO_THROW.has(rel(file))) continue;
      for (const field of throwingFields(readFileSync(file, "utf8"))) {
        offenders.push(`${rel(file)} → ${field}`);
      }
    }
    expect(
      offenders,
      "this field throws on a bad query parameter, which renders form-error copy on a page with no form — wrap it in fallback()",
    ).toEqual([]);
  });

  it("the allowlist stays honest — a listed route really does still throw", () => {
    // An exemption that no longer applies is worse than none: it hides a route
    // that has since been fixed, and invites the next one to be added beside
    // it. If a listed route stops throwing, this fails until it is delisted.
    for (const listed of ALLOWED_TO_THROW) {
      const code = readFileSync(join(process.cwd(), listed), "utf8");
      expect(
        throwingFields(code).length,
        `${listed} no longer throws — remove it from ALLOWED_TO_THROW`,
      ).toBeGreaterThan(0);
    }
  });

  it("client/conversations/new sends an incomplete link to the list", () => {
    // It was the one route allowed to throw. A bare visit must now navigate,
    // not error.
    const code = readFileSync(
      join(process.cwd(), "src/routes/_authenticated/client.conversations.new.tsx"),
      "utf8",
    );
    expect(throwingFields(code)).toEqual([]);
    expect(code).toMatch(/linkIsComplete/);
    expect(code).toMatch(/to="\/client\/conversations"/);
  });
});

describe("the routes the audit named are fixed", () => {
  const named = [
    "src/routes/intake_.confirmation.tsx",
    "src/routes/_authenticated/admin.team.tsx",
    "src/routes/_authenticated/admin.messages.tsx",
    "src/routes/_authenticated/client.tsx",
  ];

  for (const file of named) {
    it(`${file} falls back instead of throwing`, () => {
      const code = readFileSync(join(process.cwd(), file), "utf8");
      expect(code).toMatch(/validateSearch:\s*zodValidator\(/);
      expect(code).toContain("fallback(");
      expect(code, "a .parse() in validateSearch throws").not.toMatch(
        /validateSearch:.*\.parse\(/,
      );
      expect(throwingFields(code)).toEqual([]);
    });
  }
});
