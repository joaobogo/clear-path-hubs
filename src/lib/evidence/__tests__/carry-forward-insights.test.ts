import { describe, expect, it } from "vitest";
import { carryForwardInsights } from "../carry-forward-insights";

const now = new Date("2026-10-30T00:00:00Z");
const good = { pitch_summary: "Strong fit.", requirement_verdicts: [] };

describe("carryForwardInsights", () => {
  it("keeps a freshly generated briefing as it is", () => {
    const fresh = { insights: { pitch_summary: "New." }, insights_error: null };
    expect(carryForwardInsights(fresh, [{ id: "e1", extracted: { insights: good } }], now)).toBe(fresh);
  });

  it("keeps the previous briefing when generation fails", () => {
    const out = carryForwardInsights(
      { insights: null, insights_error: "gateway_402:Not enough credits" },
      [{ id: "e1", created_at: "2026-10-28T08:00:00Z", extracted: { insights: good } }],
      now,
    );
    expect(out.insights).toMatchObject({
      pitch_summary: "Strong fit.",
      carried_forward: {
        from_evidence_id: "e1",
        carried_at: "2026-10-30T00:00:00.000Z",
        reason: "gateway_402:Not enough credits",
      },
    });
    expect(out.insights_error).toBe("gateway_402:Not enough credits");
  });

  it("takes the newest earlier briefing and skips rows without one", () => {
    const out = carryForwardInsights(
      { insights: null, insights_error: "timeout" },
      [
        { id: "old", created_at: "2026-10-01T00:00:00Z", extracted: { insights: { pitch_summary: "Old." } } },
        { id: "empty", created_at: "2026-10-29T00:00:00Z", extracted: { insights: null } },
        { id: "mid", created_at: "2026-10-15T00:00:00Z", extracted: { insights: { pitch_summary: "Mid." } } },
      ],
      now,
    );
    expect(out.insights).toMatchObject({ pitch_summary: "Mid.", carried_forward: { from_evidence_id: "mid" } });
  });

  it("returns the failure unchanged when there is nothing to keep", () => {
    const fresh = { insights: null, insights_error: "cv_too_short" };
    expect(carryForwardInsights(fresh, [{ id: "e1", extracted: { insights: null } }, { id: "e2" }], now)).toBe(fresh);
  });
});
