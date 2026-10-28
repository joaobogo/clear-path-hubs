/**
 * A recruiter override is stored in score_decisions.approved_score (see the
 * `manual_override` branch of applyReviewDecision). The provenance resolver
 * must read that column, or an override of 80 on a run scored 66 reads as 66.
 */
import { describe, expect, it } from "vitest";
import { resolveScoreProvenance } from "@/lib/scoring/provenance";

const run = { score: 66, final_score: 66, raw_score: 66, evaluation_method: "deterministic" };

describe("score provenance reads the stored override", () => {
  it("uses approved_score from an override decision", () => {
    const p = resolveScoreProvenance({
      run,
      decisions: [
        {
          decision_type: "override",
          approved_score: 80,
          reason: "Recruiter final profile",
          created_at: "2026-10-28T23:00:00Z",
        },
      ],
    });
    expect(p.override?.value).toBe(80);
    expect(p.effectiveValue).toBe(80);
    expect(p.engineValue).toBe(66);
  });

  it("takes the latest override when there are several", () => {
    const p = resolveScoreProvenance({
      run,
      decisions: [
        { decision_type: "override", approved_score: 70, created_at: "2026-10-27T10:00:00Z" },
        { decision_type: "override", approved_score: 80, created_at: "2026-10-28T23:00:00Z" },
      ],
    });
    expect(p.effectiveValue).toBe(80);
  });

  it("keeps the engine score when no override exists", () => {
    const p = resolveScoreProvenance({
      run,
      decisions: [
        { decision_type: "approve", approved_score: 66, created_at: "2026-10-28T23:00:00Z" },
      ],
    });
    expect(p.override).toBeNull();
    expect(p.effectiveValue).toBe(66);
  });

  it("still reads the older alias columns", () => {
    const p = resolveScoreProvenance({
      run,
      decisions: [
        {
          decision_type: "manual_override",
          score_override: 75,
          created_at: "2026-10-28T23:00:00Z",
        },
      ],
    });
    expect(p.effectiveValue).toBe(75);
  });
});
