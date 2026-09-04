/**
 * A candidate is scored out of 100 and is never shown above 100.
 *
 * The engine's own composite is bounded — raw_score is a 0-1 value scaled, and
 * caps only reduce. The overflow came after it: the video introduction bonus is
 * added at READ time, on top of a figure that could already be 95 or higher.
 *
 * That was deliberate. The note on the constant used to read "the total may
 * exceed 100 (97 + video = 107); bands clamp for colour only". It is a
 * defensible engineering position and a poor one to show a client: a score out
 * of 100 that reads 107 looks like a defect, and no band describes it. The
 * maximum-score CV fixture would have published as 110.
 *
 * The ceiling is applied in two places on purpose — where the bonus is added,
 * so the run object never carries an off-scale number, and in publishedScore,
 * which every surface reads through, so a stored value written by an older
 * build is held too.
 *
 * The cap must not silently swallow points. When it bites, the composition
 * shows it as its own line, because that panel exists to explain where a number
 * came from and "Adjustment made in review" would credit a recruiter with a
 * change nobody made.
 */
import { describe, expect, it } from "vitest";
import {
  SCORE_MAX,
  VIDEO_INTRO_BONUS_PTS,
  clampScore,
  publishedScore,
  publishedScoreDisplay,
  publishedBand,
  withVideoIntroBonus,
} from "@/lib/scoring/published-score";
import { buildScoreComposition } from "@/lib/scoring/score-composition";

const weights = { must_have: 0.6, preferred: 0.2, screening_alignment: 0.2 };

/** Full coverage on every category, so the weighted total is the maximum. */
const capped = () =>
  buildScoreComposition({
    coverage: { must_have: 1, preferred: 1, screening_alignment: 1, category_weights: weights },
    result: null,
    displayedScore: 100,
    videoBonusPts: VIDEO_INTRO_BONUS_PTS,
  })!;

describe("clampScore", () => {
  it("holds a value at the top of the scale", () => {
    expect(clampScore(107)).toBe(100);
    expect(clampScore(100.4)).toBe(100);
  });

  it("leaves a score on the scale alone", () => {
    expect(clampScore(98)).toBe(98);
    expect(clampScore(0)).toBe(0);
  });

  it("does not turn an absent score into a zero", () => {
    // Absent and zero are different facts everywhere else in this codebase.
    expect(clampScore(null)).toBeNull();
    expect(clampScore(Number.NaN)).toBeNull();
  });

  it("holds a negative at the bottom of the scale", () => {
    expect(clampScore(-5)).toBe(0);
  });
});

describe("the video bonus cannot push a score past the ceiling", () => {
  it("caps the run the moment the bonus is folded in", () => {
    // 97 + 10 = 107 — the exact example the old comment gave.
    const run = withVideoIntroBonus({ score: 97, final_score: null }, true);
    expect(run.score).toBe(SCORE_MAX);
  });

  it("caps a perfect score, which is what the fixture produces", () => {
    const run = withVideoIntroBonus({ score: 100, final_score: null }, true);
    expect(run.score).toBe(SCORE_MAX);
    expect(publishedScoreDisplay(run)).toBe(100);
  });

  it("still lifts a score with room beneath the ceiling", () => {
    // Capping must not make the bonus pointless.
    const run = withVideoIntroBonus({ score: 62, final_score: null }, true);
    expect(run.score).toBe(62 + VIDEO_INTRO_BONUS_PTS);
  });

  it("leaves a candidate without a video untouched", () => {
    expect(withVideoIntroBonus({ score: 97, final_score: null }, false).score).toBe(97);
  });
});

describe("publishedScore holds the ceiling for values it did not produce", () => {
  it("caps a stored final_score above the scale", () => {
    // A human adjustment or an older build could have written this.
    expect(publishedScore({ score: 88, final_score: 118 })).toBe(100);
    expect(publishedScoreDisplay({ score: 88, final_score: 118 })).toBe(100);
  });

  it("gives an off-scale value a real band rather than nothing", () => {
    expect(publishedBand({ score: 107, final_score: null })).not.toBeNull();
  });

  it("still reports no score when there is none", () => {
    expect(publishedScore({ score: null, final_score: null })).toBeNull();
  });
});

describe("the breakdown still adds up when the ceiling bites", () => {
  it("shows the cap as its own line, not as a review adjustment", () => {
    const c = capped();
    expect(
      c.components.find((k) => k.key === "score_ceiling"),
      "a capped score must say so in the breakdown",
    ).toBeDefined();
    expect(
      c.components.find((k) => k.key === "review_adjustment"),
      "the cap is not a decision a recruiter made",
    ).toBeUndefined();
  });

  it("reconciles: the lines sum to the number printed beside them", () => {
    const c = capped();
    const sum = c.components.reduce((n, k) => n + k.displayPts, 0) + c.videoBonusPts;
    expect(sum).toBe(c.grandTotalPts);
    expect(c.grandTotalPts).toBe(100);
  });
});

describe("a capped score can still be decomposed truthfully", () => {
  it("keeps what the parts summed to, so a breakdown need not infer one", () => {
    // 98 evidence + 10 video = 108, published at 100. A surface that recovers
    // the evidence figure as (published - bonus) would print 90 and be wrong
    // about the evidence by 8, while still "adding up".
    const run = withVideoIntroBonus({ score: 98, final_score: null }, true);
    expect(publishedScore(run)).toBe(100);
    expect(
      (run as { score_uncapped?: number | null }).score_uncapped,
      "the pre-ceiling total is what makes an honest breakdown possible",
    ).toBe(108);

    const evidence = (run as unknown as { score_uncapped: number }).score_uncapped - VIDEO_INTRO_BONUS_PTS;
    expect(evidence, "the evidence figure is the one the engine produced").toBe(98);
  });

  it("is absent when no cap was involved, so old arithmetic still holds", () => {
    const run = withVideoIntroBonus({ score: 62, final_score: null }, true);
    const uncapped = (run as { score_uncapped?: number | null }).score_uncapped;
    // Present, and equal to the published figure — subtraction is correct here.
    expect(uncapped).toBe(72);
    expect(publishedScore(run)).toBe(72);
  });
});

describe("the breakdown reconciles across the whole scale", () => {
  const cases: Array<[string, number, number, number, number, number]> = [
    ["perfect with video",        1,    1,     1,   100, VIDEO_INTRO_BONUS_PTS],
    ["near-perfect with video",   1,    0.95,  1,   100, VIDEO_INTRO_BONUS_PTS],
    ["perfect without video",     1,    1,     1,   100, 0],
    ["mid with video",            0.75, 0.5,   0.6, 77,  VIDEO_INTRO_BONUS_PTS],
    ["low without video",         0.3,  0.2,   0.4, 27,  0],
    ["human adjusted downward",   1,    1,     1,   84,  0],
  ];

  for (const [name, mh, pr, sa, displayed, bonus] of cases) {
    it(`${name}: components sum to the headline, and the headline is on the scale`, () => {
      const c = buildScoreComposition({
        coverage: { must_have: mh, preferred: pr, screening_alignment: sa, category_weights: weights },
        result: null,
        displayedScore: displayed,
        videoBonusPts: bonus,
      })!;
      const sum = c.components.reduce((n, k) => n + k.displayPts, 0) + c.videoBonusPts;
      expect(sum, "the parts must add up to the number printed beside them").toBe(c.grandTotalPts);
      expect(c.grandTotalPts).toBe(displayed);
      expect(c.grandTotalPts).toBeLessThanOrEqual(SCORE_MAX);
    });
  }
});
