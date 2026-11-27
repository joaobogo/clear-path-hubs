import { describe, expect, it } from "vitest";
import { clientDealbreakerWarnings } from "@/lib/client/dealbreaker-publication";

const base = {
  admin_status: "approved", approved_score_run_id: "run", score_runs: { raw_score: 95 },
  eligibility_checks: [{
    qualifier_key: "recruiter_review:flight", status: "excepted",
    evidence: { publication_override: { score_run_id: "run", preserve_cap: true, client_warning: "cannot pay own flight to Poland" } },
    eligibility_exceptions: [{ revoked_at: null, expires_at: null }],
  }],
};

describe("capped publication warning", () => {
  it("exposes Elias's 95 as context without changing the capped 15", () => {
    const row = { ...base, score_runs: { raw_score: 95, final_score: 15 } };
    expect(clientDealbreakerWarnings(row)[0]?.uncapped_score).toBe(95);
    expect(row.score_runs.final_score).toBe(15);
  });
  it("exposes Frederico's 85 as context without changing the capped 15", () => {
    const row = { ...base, score_runs: { raw_score: 85, final_score: 15 } };
    expect(clientDealbreakerWarnings(row)[0]?.uncapped_score).toBe(85);
    expect(row.score_runs.final_score).toBe(15);
  });
  it("does not expose rejected candidates", () => {
    expect(clientDealbreakerWarnings({ ...base, admin_status: "rejected" })).toEqual([]);
  });
  it("does not reuse an override for a different run", () => {
    expect(clientDealbreakerWarnings({ ...base, approved_score_run_id: "other" })).toEqual([]);
  });
  it("ignores revoked or expired exceptions", () => {
    for (const exception of [{ revoked_at: "2026-11-18", expires_at: null }, { revoked_at: null, expires_at: "2026-11-17" }]) {
      expect(clientDealbreakerWarnings({ ...base, eligibility_checks: [{ ...base.eligibility_checks[0], eligibility_exceptions: [exception] }] }, Date.parse("2026-11-18"))).toEqual([]);
    }
  });
  it("never sends internal reason or actor fields to clients", () => {
    const row = { ...base, eligibility_checks: [{ ...base.eligibility_checks[0], reason: "private research", actor_user_id: "private" }] };
    expect(Object.keys(clientDealbreakerWarnings(row)[0] ?? {}).sort()).toEqual(["label", "uncapped_score"]);
  });
});