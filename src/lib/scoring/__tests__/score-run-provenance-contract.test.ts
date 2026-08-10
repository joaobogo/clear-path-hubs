import { describe, expect, it } from "vitest";
import {
  EVALUATION_METHODS,
  isEvaluationMethod,
  normalizeEvaluationMethod,
} from "../evaluation-method";
import { EVALUATION_METHOD } from "../engine-calibration";
import { HUMAN_EVALUATION_METHOD } from "../human-adjustment";

/**
 * The database now enforces exactly this vocabulary on score_runs
 * (constraint `score_runs_evaluation_method_check`). If someone widens or
 * renames a method in code without the matching migration, every score-run
 * insert would fail at runtime — so the list is pinned here.
 */
const DB_ALLOWED = ["deterministic", "semantic", "human_adjusted", "legacy"] as const;

describe("score run evaluation_method contract", () => {
  it("code vocabulary matches the database check constraint exactly", () => {
    expect([...EVALUATION_METHODS].sort()).toEqual([...DB_ALLOWED].sort());
  });

  it("every value a writer stamps is accepted by the database", () => {
    for (const written of [EVALUATION_METHOD, HUMAN_EVALUATION_METHOD]) {
      expect(DB_ALLOWED).toContain(written);
      expect(isEvaluationMethod(written)).toBe(true);
    }
  });

  it("retired labels are never presented as a real engine path", () => {
    expect(normalizeEvaluationMethod("hybrid")).toBe("legacy");
    expect(normalizeEvaluationMethod(null)).toBe("legacy");
    expect(normalizeEvaluationMethod("")).toBe("legacy");
    expect(normalizeEvaluationMethod("deterministic_keyword")).toBe("deterministic");
    expect(isEvaluationMethod("hybrid")).toBe(false);
  });
});
