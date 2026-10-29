/**
 * B3: new candidates are processed in full on arrival; thin CV text gets one
 * retry and only one; an unscored candidate always has an admin task.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_THIN_TEXT_ATTEMPTS,
  THIN_CV_CHARS,
  candidateReviewTask,
  needsExtractionRetry,
  needsReviewTask,
  storedTextNeedsReread,
} from "@/lib/cv/unscored-review";
import { resolveParseFailure } from "@/lib/parse-failure/parse-failure-codes";

const fresh = { needsOcr: false, garbage: false, ocrUsed: false, priorAttempts: 0 };

describe("needsExtractionRetry", () => {
  it("retries thin or empty text once on a fresh file", () => {
    expect(THIN_CV_CHARS).toBe(1500);
    expect(needsExtractionRetry({ ...fresh, chars: 900 })).toBe(true);
    expect(needsExtractionRetry({ ...fresh, chars: 0 })).toBe(true);
    expect(needsExtractionRetry({ ...fresh, chars: 1500 })).toBe(false);
  });

  it("only once: a file already read once is never re-read automatically again", () => {
    expect(MAX_THIN_TEXT_ATTEMPTS).toBe(2);
    expect(needsExtractionRetry({ ...fresh, chars: 900, priorAttempts: 1 })).toBe(false);
    expect(needsExtractionRetry({ ...fresh, chars: 900, priorAttempts: 3 })).toBe(false);
  });

  it("respects the single OCR attempt: no retry after OCR or for a scan", () => {
    expect(needsExtractionRetry({ ...fresh, chars: 900, ocrUsed: true })).toBe(false);
    expect(needsExtractionRetry({ ...fresh, chars: 50, needsOcr: true })).toBe(false);
    expect(needsExtractionRetry({ ...fresh, chars: 900, garbage: true })).toBe(false);
  });
});

describe("storedTextNeedsReread", () => {
  it("re-reads thin stored text once for a candidate never scored", () => {
    expect(storedTextNeedsReread({ chars: 800, ocrUsed: false, attempts: 1, hasScore: false })).toBe(true);
    expect(storedTextNeedsReread({ chars: 800, ocrUsed: false, attempts: 2, hasScore: false })).toBe(false);
  });

  it("never touches a scored candidate or OCR text", () => {
    expect(storedTextNeedsReread({ chars: 800, ocrUsed: false, attempts: 1, hasScore: true })).toBe(false);
    expect(storedTextNeedsReread({ chars: 800, ocrUsed: true, attempts: 1, hasScore: false })).toBe(false);
    expect(storedTextNeedsReread({ chars: 4000, ocrUsed: false, attempts: 1, hasScore: false })).toBe(false);
  });
});

describe("needsReviewTask", () => {
  const ran = [{ step: "parse", ok: false }];
  it("every unscored outcome needs a task", () => {
    for (const state of ["failed", "ocr_required", "provider_blocked", "manual_review_required"]) {
      expect(needsReviewTask({ final_state: state, steps: ran }, { current_score_run_id: null }), state).toBe(true);
    }
  });

  it("scored, in-progress and skipped runs do not", () => {
    expect(needsReviewTask({ final_state: "scored", steps: ran }, {})).toBe(false);
    expect(needsReviewTask({ final_state: "ready_to_score", steps: ran }, {})).toBe(false);
    expect(
      needsReviewTask({ final_state: "manual_review_required", steps: [{ step: "skip", ok: true }] }, {}),
    ).toBe(false);
    // Low-confidence review of a scored match already has its review.
    expect(
      needsReviewTask({ final_state: "manual_review_required", steps: ran }, { current_score_run_id: "run1" }),
    ).toBe(false);
    expect(needsReviewTask({ final_state: "failed", steps: ran }, { current_score_run_id: "run1" })).toBe(false);
    // A run that hit the retry ceiling did act, so it does get one.
    expect(
      needsReviewTask({ final_state: "manual_review_required", steps: [{ step: "skip", ok: false }] }, {}),
    ).toBe(true);
  });
});

describe("candidateReviewTask", () => {
  it("a thin CV names the cause, the next step, and that nothing was sent", () => {
    const t = candidateReviewTask({
      code: "cv_text_thin",
      message: "Only 840 characters could be read from the CV after 2 attempts.",
      candidateName: "Amira Hassan",
      positionTitle: "Group Marketing Manager",
    });
    expect(t.title).toBe("Amira Hassan for Group Marketing Manager: CV needs review before scoring");
    expect(t.description).toMatch(/^Very little text\./);
    expect(t.description).toMatch(/Only 840 characters/);
    expect(t.description).toMatch(/\/admin\/parse-failures.*nothing has been sent to the candidate/);
    expect(t.reason).toBe("cv_text_thin");
    expect(t.priority).toBe("normal");
  });

  it("non-CV causes say what to do", () => {
    expect(candidateReviewTask({ code: "requirements_missing" }).description).toMatch(/Add must-haves/);
    expect(candidateReviewTask({ code: "position_inactive" }).title).toBe("Candidate: not scored yet");
    expect(candidateReviewTask({ code: "engine_error", message: "boom" }).priority).toBe("high");
    expect(candidateReviewTask({ code: "pdf_parse_failed:bad xref" }).reason).toBe("pdf_parse_failed");
  });

  it("the parse-failure catalogue knows the thin-text code", () => {
    const f = resolveParseFailure("cv_text_thin");
    expect(f.reuploadFixes).toBe(true);
    expect(f.candidateMessage).toMatch(/upload it again/);
  });
});
