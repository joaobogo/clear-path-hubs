import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Candidate-facing copy guard.
 *
 * Candidates are told about "screening" and "application review". They are
 * never shown an "AI score", a numeric score, a rank or a rubric name — that
 * vocabulary belongs to staff and (as a fit band) to clients.
 *
 * This test reads the real candidate surfaces, so new copy that reintroduces
 * the internal vocabulary fails here rather than in front of an applicant.
 */

const ROOT = join(process.cwd(), "src");

/** Files a candidate can actually see rendered. */
const CANDIDATE_FILES: string[] = [
  ...routeFiles(),
  "components/candidate/journey-timeline.tsx",
  "lib/candidate/status-vocabulary.ts",
  "lib/candidate/closed-outcome.ts",
  "lib/candidate/outcome-sla.ts",
  "lib/candidate/candidate-transparency.ts",
];

function routeFiles(): string[] {
  const out: string[] = [];
  const push = (dir: string, keep: (name: string) => boolean) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      if (!name.endsWith(".tsx")) continue;
      if (!keep(name)) continue;
      const full = join(ROOT, dir, name);
      if (statSync(full).isFile()) out.push(join(dir, name));
    }
  };
  push("routes", (n) => /^(apply|jobs|candidate-join|candidate-success)/.test(n));
  push("routes/_authenticated", (n) => /^me[.]/.test(n) || n === "me.tsx");
  return out;
}

/** Terms that must never reach a candidate, with the accepted wording. */
const BANNED: { pattern: RegExp; instead: string }[] = [
  { pattern: /\bAI[- ]?(score|scored|scoring|rating|ranked|ranking)\b/i, instead: "screening / application review" },
  { pattern: /\byour score\b/i, instead: "your application review" },
  { pattern: /\bscored against\b/i, instead: "screened against" },
  { pattern: /\bhow you were scored\b/i, instead: "how you were reviewed" },
  { pattern: /\b(rank|ranks|ranked|ranking) you\b/i, instead: "review your application" },
  { pattern: /\bif you rank\b/i, instead: "if you go forward" },
  { pattern: /\brubric\b/i, instead: "what the role asks for" },
];

describe("candidate-facing copy", () => {
  it("covers the real candidate surfaces", () => {
    expect(CANDIDATE_FILES.length).toBeGreaterThan(5);
  });

  for (const rel of CANDIDATE_FILES) {
    it(`${rel} avoids internal scoring vocabulary`, () => {
      const source = readFileSync(join(ROOT, rel), "utf8");
      // Only user-visible text matters: string and template literals.
      const literals = source.match(/"[^"\n]{4,}"|'[^'\n]{4,}'|`[^`]{4,}`/g) ?? [];
      const offences: string[] = [];
      for (const raw of literals) {
        const text = raw.slice(1, -1);
        // Skip import paths, class names and query keys — not prose.
        if (!/\s/.test(text)) continue;
        if (/^[a-z0-9:_\-/ ]+$/.test(text) && !/[.?!]/.test(text)) continue;
        for (const { pattern, instead } of BANNED) {
          if (pattern.test(text)) offences.push(`"${text}" → use ${instead}`);
        }
      }
      expect(offences, offences.join("\n")).toEqual([]);
    });
  }

  it("says screening or review somewhere on the candidate journey page", () => {
    const source = readFileSync(join(ROOT, "routes/candidate-success.tsx"), "utf8");
    expect(/screening|review/i.test(source)).toBe(true);
  });
});
