/**
 * One candidate, one score, on every review surface.
 *
 * /admin/scoring/review has two readers: the main queue and the triage lists
 * that render "Blocking a client deliverable". The main one applied the
 * intro-video bonus, rebanded from the total, and voided a score whose CV was
 * unreadable. The triage one did none of that, so Kendy Elisca read
 * "Consider · 67" on the queue a reviewer works from and "77 · Strong" on the
 * record a recruiter works from — across a band boundary, so the two reach
 * different decisions about the same person (audit #8, TF8-02).
 *
 * The symptom had been filed and fixed once already, in the main reader alone
 * (audit #6, A6-02). Both readers share this derivation now.
 */
import { describe, expect, it } from "vitest";
import { reviewRowScore } from "@/lib/scoring/review-row-score";
import { VIDEO_INTRO_BONUS_PTS } from "@/lib/scoring/published-score";
import { classifyBand } from "@/lib/scoring/bands";

const withVideo = { intro_video_url: "https://example.com/v.mp4", processing_state: "scored" };
const noVideo = { intro_video_url: null, processing_state: "scored" };

describe("reviewRowScore", () => {
  it("adds the intro-video bonus", () => {
    expect(reviewRowScore(67.1, withVideo).final_score).toBeCloseTo(67.1 + VIDEO_INTRO_BONUS_PTS);
  });

  it("leaves a score without a video alone", () => {
    expect(reviewRowScore(67.1, noVideo).final_score).toBeCloseTo(67.1);
  });

  it("bands from the total, not the pre-bonus figure", () => {
    // The exact defect: a stored band computed before the bonus kept saying
    // "Consider" beside a number the bonus had pushed into the next band.
    const base = 67.1;
    const { final_score, score_band } = reviewRowScore(base, withVideo);
    expect(score_band).toBe(classifyBand(final_score!));
    expect(score_band).not.toBe(classifyBand(base));
  });

  it("reports no score when the CV proved unreadable", () => {
    const r = reviewRowScore(41, { intro_video_url: null, processing_state: "ocr_required" });
    expect(r).toEqual({ final_score: null, score_band: null });
  });

  it("does not resurrect an unreadable score via the video bonus", () => {
    const r = reviewRowScore(41, {
      intro_video_url: "https://example.com/v.mp4",
      processing_state: "ocr_required",
    });
    expect(r).toEqual({ final_score: null, score_band: null });
  });

  it("handles an absent score without inventing one", () => {
    for (const base of [null, undefined, Number.NaN]) {
      expect(reviewRowScore(base, withVideo)).toEqual({ final_score: null, score_band: null });
    }
  });

  it("survives a missing match record", () => {
    expect(reviewRowScore(80, null).final_score).toBe(80);
    expect(reviewRowScore(80, undefined).final_score).toBe(80);
  });
});

describe("both review readers use it", () => {
  it("neither re-implements the bonus locally", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const rel of [
      join("src", "lib", "scoring-review.functions.ts"),
      join("src", "lib", "scoring-review-triage.server.ts"),
    ]) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src, `${rel} does not use the shared derivation`).toContain("reviewRowScore");
      // A local `+ VIDEO_INTRO_BONUS_PTS` is how the two drifted apart.
      expect(src, `${rel} adds the bonus itself`).not.toMatch(/\+\s*VIDEO_INTRO_BONUS_PTS/);
    }
  });
});
