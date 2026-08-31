/**
 * A score built on text that proved unreadable is not a score.
 *
 * scoreVoidedByUnreadableCv already existed and was applied on the candidate
 * detail header, the profile tab, the score tab, the client KPIs and the
 * review queue — but not on /admin/candidates. So a candidate whose own page
 * read "No score — CV unreadable" sat in the list as "41 · not recommended",
 * and the list is what a recruiter acts on (audit #8, TF8-01). The same
 * candidate also carried a full narrative assessment on the CV tab, asserting
 * demonstrated experience drawn from a document that produced no text.
 *
 * This reads the source: any surface that resolves a published score must
 * decide what to do about an unreadable CV, and the two that suppress prose
 * must keep doing so.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = sourceFiles(join(process.cwd(), "src"));

/** Files that turn a run into a number or a band for display. */
const SCORE_RESOLVERS = /publishedScoreDisplay\(|publishedBand\(/;

describe("unreadable CVs carry no score", () => {
  it("finds the surfaces it is guarding", () => {
    const users = FILES.filter((f) => SCORE_RESOLVERS.test(readFileSync(f, "utf8")));
    expect(users.length).toBeGreaterThan(1);
  });

  it("every surface that displays a published score also voids it", () => {
    const offenders: string[] = [];

    // AdminScoreNumber is a run-only primitive: it receives a score run, which
    // by definition carries no processing_state, so it cannot make this
    // decision. Its callers hold the match and must.
    const RUN_ONLY_PRIMITIVES = [
      join("components", "admin", "admin-score-number.tsx"),
      join("components", "unicorn-marker.tsx"),
    ];

    for (const file of FILES) {
      // The resolver module defines both; it is not a display surface.
      if (file.endsWith(join("scoring", "published-score.ts"))) continue;
      if (RUN_ONLY_PRIMITIVES.some((p) => file.endsWith(p))) continue;
      const src = readFileSync(file, "utf8");
      if (!SCORE_RESOLVERS.test(src)) continue;
      if (!src.includes("scoreVoidedByUnreadableCv")) {
        offenders.push(file.replace(process.cwd(), ""));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("both candidate tabs withhold the model's prose for an unreadable CV", () => {
    // profile-tab suppressed it; the CV tab did not, which is the whole
    // finding. Its own comment about dealbreakers already says suppression has
    // to apply on every tab, not just the one where it was noticed.
    for (const rel of [
      join("src", "components", "admin", "candidate-detail", "profile-tab.tsx"),
      join("src", "components", "admin", "candidate-detail", "tabs.tsx"),
    ]) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src, `${rel} does not know about unreadable CVs`).toMatch(
        /unreadable/,
      );
    }
  });
});
