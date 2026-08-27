import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  publishedScore,
  publishedBand,
  withVideoIntroBonus,
  hasVideoIntro,
  VIDEO_INTRO_BONUS_PTS,
} from "@/lib/scoring/published-score";

/**
 * Admin and client must never show different scores for the same candidate.
 *
 * The published number is the engine score, plus a human adjustment when one
 * exists (final_score), plus the video bonus when the match carries an intro
 * link. Two failure modes have both happened in production:
 *
 *   1. A surface reads `run.score` directly, so a human adjustment vanishes.
 *   2. A surface's SELECT omits `intro_video_url` or `final_score`, so the
 *      folding helper has nothing to fold and silently returns the raw run.
 *
 * The second is the nastier one: the code looks correct, and the number is
 * quietly wrong. A reviewer saw "64 · Consider" beside a client preview
 * reading "74 · Strong" — a ten-point gap, exactly the video bonus, on the
 * one figure the whole product is built on.
 *
 * These tests pin the arithmetic AND the selects, because a select is where
 * this breaks without anyone noticing.
 */

const read = (p: string) => readFileSync(p, "utf8");

describe("published score arithmetic", () => {
  const run = { score: 64, final_score: null, fit_label: null, fit_band: null };

  it("adds the video bonus exactly once", () => {
    const folded = withVideoIntroBonus(run, true);
    expect(publishedScore(folded)).toBe(64 + VIDEO_INTRO_BONUS_PTS);
    expect(publishedScore(withVideoIntroBonus(folded, false))).toBe(74);
  });

  it("does not add it when there is no video", () => {
    expect(publishedScore(withVideoIntroBonus(run, false))).toBe(64);
  });

  it("prefers a human adjustment over the engine score, and still folds the bonus", () => {
    const adjusted = { ...run, final_score: 80 };
    expect(publishedScore(adjusted)).toBe(80);
    expect(publishedScore(withVideoIntroBonus(adjusted, true))).toBe(90);
  });

  it("bands from the published number, not the raw one", () => {
    // 64 and 74 sit in different bands — this gap is what the client saw.
    expect(publishedBand(run)).not.toBe(publishedBand(withVideoIntroBonus(run, true)));
  });

  it("reads the video flag off the match row, not the run", () => {
    expect(hasVideoIntro({ intro_video_url: "https://loom.com/share/x" })).toBe(true);
    expect(hasVideoIntro({ intro_video_url: "   " })).toBe(false);
    expect(hasVideoIntro({})).toBe(false);
    expect(hasVideoIntro(null)).toBe(false);
  });
});

/**
 * Every module that resolves a score for a human MUST select the columns the
 * folding helpers need. Add the columns — do not add the file to this list.
 */
const SCORE_SURFACES = [
  "src/lib/client-kpi.server.ts",
  "src/lib/client-positions.functions.ts",
  "src/lib/shares.functions.ts",
  "src/lib/admin.functions.ts",
  "src/lib/processing.functions.ts",
];

describe("score-bearing selects carry what the folding needs", () => {
  it.each(SCORE_SURFACES)("%s selects intro_video_url", (file) => {
    expect(read(file)).toContain("intro_video_url");
  });

  it.each(SCORE_SURFACES)("%s selects final_score", (file) => {
    expect(read(file)).toContain("final_score");
  });

  it.each(SCORE_SURFACES)("%s folds the bonus, or delegates to what does", (file) => {
    const src = read(file);
    // Folding here, or handing the row to toClientCandidateDTO which folds,
    // are both correct. What is not correct is reading run.score and rendering
    // it — that is the bug this whole file exists to prevent.
    const folds =
      src.includes("withVideoIntroBonus") ||
      src.includes("withPublishedRun") ||
      src.includes("toClientCandidateDTO");
    expect(folds).toBe(true);
  });
});
