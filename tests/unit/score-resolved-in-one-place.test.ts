/**
 * One resolver decides what a candidate's score is.
 *
 * published-score.ts opens by saying so: "Every surface — admin list, client
 * list, candidate detail, exports — must resolve score and band through the
 * functions here." Several surfaces resolved it inline as
 * `final_score ?? score` instead, and each drifted its own way:
 *
 *   - `?? 0` turned "no score" into a printed 0, and on the score tab into
 *     "Evidence score -10.0 + intro video +10 = 0" once the bonus was
 *     subtracted from it.
 *   - The evidence record gated on `score != null` and then read
 *     `final_score ?? score`, so a run whose number came from a human
 *     adjustment — which writes final_score and leaves score null — rendered
 *     as "—" despite having a published figure.
 *   - Any inline copy also skips the unreadable-CV void that lives in the
 *     resolver (audit #8, TF8-01).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { publishedScore } from "@/lib/scoring/published-score";

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

/** `final_score ?? score` / `final_score || score` written by hand. */
const INLINE_RESOLUTION = /final_score\s*(\?\?|\|\|)\s*(\w+\.)?score\b/;

/**
 * Files allowed to write it: the resolver itself, and the places that must
 * read the raw stored columns rather than the published figure.
 */
const ALLOWED = [
  join("lib", "scoring", "published-score.ts"),
  // Writes a new run FROM the stored columns; it is producing the value, not
  // displaying it.
  join("lib", "scoring", "human-adjusted-run.server.ts"),
  // Replays a stored run against the engine to compare raw inputs.
  join("lib", "scoring", "replay.server.ts"),
  // Compares the stored columns against each other to detect a bad write.
  join("lib", "scoring", "publish-gate.ts"),
];

describe("score resolution", () => {
  it("happens in one place", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      if (ALLOWED.some((a) => file.endsWith(a))) continue;
      // Comments describing this very defect would otherwise trip the guard.
      // Blanked rather than deleted so line numbers still point at the code.
      const lines = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!INLINE_RESOLUTION.test(line)) return;
        // Feeding the shared derivation its base figure is the correct use.
        if (/reviewRowScore\(/.test(lines.slice(Math.max(0, i - 2), i + 1).join(" "))) return;
        offenders.push(`${file.replace(process.cwd(), "")}:${i + 1}`);
      });
    }

    expect(offenders).toEqual([]);
  });
});

describe("publishedScore", () => {
  it("prefers a human adjustment over the engine figure", () => {
    expect(publishedScore({ score: 67, final_score: 77 })).toBe(77);
  });

  it("reads final_score when the engine figure is absent", () => {
    // This is the case the evidence record got wrong: it gated on `score`.
    expect(publishedScore({ score: null, final_score: 77 })).toBe(77);
  });

  it("returns null rather than zero when there is no number", () => {
    expect(publishedScore({ score: null, final_score: null })).toBeNull();
    expect(publishedScore({})).toBeNull();
    expect(publishedScore(null)).toBeNull();
  });

  it("keeps a genuine zero", () => {
    expect(publishedScore({ score: 0, final_score: null })).toBe(0);
  });
});
