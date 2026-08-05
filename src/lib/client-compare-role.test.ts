import { describe, it, expect } from "vitest";
import {
  buildRoleComparison,
  roleCompareDisabledReason,
  ROLE_COMPARE_MAX,
} from "@/lib/client-compare";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function candidate(over: Record<string, unknown> = {}): ClientCandidateDTO {
  return {
    match_id: String(over.match_id ?? "m1"),
    stage: (over.stage ?? "delivered") as ClientCandidateDTO["stage"],
    candidate: {
      display_name: "Ana R.",
      location: "Lisbon",
      availability: "Two weeks",
      years_experience: 8,
      current_role: "Ops Lead",
      current_company: "Acme",
      headline: null,
      ...(over.candidate as object),
    },
    requirement_rows: (over.requirement_rows ?? [
      { id: "a", label: "Payroll systems", importance: "must_have", status: "met", explanation: null, evidence: [] },
      { id: "b", label: "Multi-site", importance: "must_have", status: "missing", explanation: null, evidence: [] },
    ]) as ClientCandidateDTO["requirement_rows"],
    experience: (over.experience ?? [
      { title: "Ops Lead", company: "Acme", period: "2021–now", description: null },
    ]) as ClientCandidateDTO["experience"],
    work_authorization: ("work_authorization" in over
      ? over.work_authorization
      : "EU citizen") as string | null,
  } as unknown as ClientCandidateDTO;
}

describe("buildRoleComparison", () => {
  it("caps the comparison at three columns", () => {
    const c = buildRoleComparison([
      candidate({ match_id: "m1" }),
      candidate({ match_id: "m2" }),
      candidate({ match_id: "m3" }),
      candidate({ match_id: "m4" }),
    ]);
    expect(c.columns).toHaveLength(ROLE_COMPARE_MAX);
    expect(c.columns.map((x) => x.matchId)).toEqual(["m1", "m2", "m3"]);
  });

  it("groups identical rows away from differing rows", () => {
    const c = buildRoleComparison([
      candidate({ match_id: "m1" }),
      candidate({ match_id: "m2", candidate: { display_name: "Bo T.", location: "Porto", availability: "Two weeks", years_experience: 8, current_role: "Ops Lead", current_company: "Acme" } }),
    ]);
    expect(c.differing.map((r) => r.key)).toContain("location");
    expect(c.identical.map((r) => r.key)).toContain("work_auth");
    expect(c.identical.map((r) => r.key)).toContain("availability");
  });

  it("splits must-haves into met and missing without any score", () => {
    const c = buildRoleComparison([candidate({ match_id: "m1" }), candidate({ match_id: "m2" })]);
    const met = c.identical.concat(c.differing).find((r) => r.key === "must_met");
    const missing = c.identical.concat(c.differing).find((r) => r.key === "must_missing");
    expect(met?.values[0].lines).toEqual(["Payroll systems"]);
    expect(missing?.values[0].lines).toEqual(["Multi-site"]);
    const serialized = JSON.stringify(c);
    expect(serialized).not.toMatch(/score|percentile|rank/i);
  });

  it("falls back to plain text when fields are absent", () => {
    const c = buildRoleComparison([
      candidate({ match_id: "m1", work_authorization: null, experience: [], candidate: { display_name: "Ana R.", location: null, availability: null, years_experience: null, current_role: null, current_company: null } }),
      candidate({ match_id: "m2" }),
    ]);
    const auth = c.differing.find((r) => r.key === "work_auth");
    expect(auth?.values[0].lines).toEqual(["Not recorded"]);
  });

  it("explains why compare is disabled", () => {
    expect(roleCompareDisabledReason(1)).toMatch(/at least two/i);
    expect(roleCompareDisabledReason(2)).toBeNull();
    expect(roleCompareDisabledReason(3)).toBeNull();
    expect(roleCompareDisabledReason(4)).toMatch(/up to three/i);
  });
});
