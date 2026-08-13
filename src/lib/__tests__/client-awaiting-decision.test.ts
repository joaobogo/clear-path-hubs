import { describe, it, expect } from "vitest";
import { isAwaitingClientDecision, type KpiRow } from "@/lib/client-kpi.server";

const row = (over: Partial<KpiRow> = {}): KpiRow => ({
  id: "m1",
  candidate_profile_id: "c1",
  position_id: "p1",
  stage: "delivered",
  approved_score_run_id: "r1",
  delivered_at: "2026-01-01T00:00:00Z",
  approved_score: 80,
  approved_fit_label: "strong_fit",
  approved_fit_band: "strong",
  interview_active: false,
  interview_scheduled: false,
  interview_needs_confirmation: false,
  next_interview_at: null,
  interview_requested_at: null,
  stage_entered_at: "2026-01-01T00:00:00Z",
  client_decision_due_at: null,
  recommendation: null,
  client_decided: false,
  ...over,
});

describe("isAwaitingClientDecision", () => {
  it("counts a delivered candidate with no recorded client decision", () => {
    expect(isAwaitingClientDecision(row())).toBe(true);
  });

  it("still counts it when we recorded an internal recommendation", () => {
    // Our recommendation is not the client's answer — this was the KPI bug.
    expect(isAwaitingClientDecision(row({ recommendation: "shortlist" }))).toBe(true);
  });

  it("clears once a client decision row exists", () => {
    expect(isAwaitingClientDecision(row({ client_decided: true }))).toBe(false);
  });

  it("clears once the candidate has moved past delivered", () => {
    expect(isAwaitingClientDecision(row({ stage: "shortlisted" }))).toBe(false);
  });

  it("ignores candidates never delivered", () => {
    expect(isAwaitingClientDecision(row({ delivered_at: null }))).toBe(false);
  });
});
