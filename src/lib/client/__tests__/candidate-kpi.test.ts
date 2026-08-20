import { describe, it, expect } from "vitest";
import { computeCandidateKpis } from "./candidate-kpi";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function candidate(
  stage: ClientCandidateDTO["stage"],
  band: ClientCandidateDTO["fit"]["band"],
): ClientCandidateDTO {
  return {
    match_id: `m-${stage}-${band}`,
    position_id: "p1",
    stage,
    org: { id: "o1", display_name: "Demo" },
    candidate: {
      id: "c1",
      display_name: "Candidate",
      headline: "Headline",
      years_experience: 5,
      location: "City",
      current_role: "Role",
      current_company: "Company",
    },
    score: 75,
    fit_label: band,
    fit: { band, score: 75 },
    evidence_support: "strong",
    unicorn: false,
    updated_at: new Date().toISOString(),
    can_interview: true,
    contact_released: true,
    status: "active",
  };
}

describe("computeCandidateKpis", () => {
  it("counts all delivered rows and maps stages to the correct tiles", () => {
    const rows: ClientCandidateDTO[] = [
      candidate("delivered", "exceptional"),
      candidate("shortlisted", "top"),
      candidate("shortlisted", "strong"),
      candidate("shortlisted", "not_recommended"),
      candidate("interview_process", "strong"),
      candidate("interview_process", "top"),
      candidate("interview_process", "consider"),
      candidate("offer", "consider"),
      candidate("offer", "not_recommended"),
      candidate("hired", "top"),
    ];

    expect(computeCandidateKpis(rows)).toEqual({
      delivered: 10,
      top: 6, // exceptional + top + strong
      shortlisted: 3,
      interviewing: 3,
      offers: 2,
      hires: 1,
    });
  });

  it("handles zero rows gracefully", () => {
    expect(computeCandidateKpis([])).toEqual({
      delivered: 0,
      top: 0,
      shortlisted: 0,
      interviewing: 0,
      offers: 0,
      hires: 0,
    });
  });
});
