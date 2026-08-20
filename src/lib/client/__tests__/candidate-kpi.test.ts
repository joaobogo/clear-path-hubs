import { describe, it, expect } from "vitest";
import { computeCandidateKpis } from "../candidate-kpi";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function candidate(
  stage: ClientCandidateDTO["stage"],
  band: ClientCandidateDTO["fit"]["band"],
): ClientCandidateDTO {
  return {
    match_id: `m-${stage}-${band}`,
    position_id: "p1",
    stage,
    delivered_at: new Date().toISOString(),
    interview_active: stage === "interview_process",
    contact_released: true,
    stage_entered_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    position: { id: "p1", title: "Role" },
    unicorn: band === "exceptional",
    freshness: { state: "current", label: "Current" },
    candidate: {
      full_name: "Candidate",
      display_name: "Candidate",
      email: null,
      phone: null,
      location: null,
      timezone: null,
      headline: null,
      headline_chips: [],
      availability: null,
      years_experience: 5,
      summary: null,
      current_role: null,
      current_company: null,
      organization_name: null,
      links: { linkedin: null, portfolio: null, github: null, website: null },
    },
    score: 75,
    fit_label: band,
    fit: { band, headline: band, recommendation: "rec", tone: "positive", accent: "emerald" },
    summary: null,
    strengths: [],
    concerns: [],
    main_consideration: null,
    requirement_rows: [],
    coverage: { must_haves: { met: 0, total: 0 }, nice_to_haves: { met: 0, total: 0 }, screening: { met: 0, total: 0 } },
    score_composition: null,
    evidence_support: { supported: 0, total: 0 },
    human_review: { reviewed: false, verified_requirements: 0, statement: null },
    explanation: { basis: "score", label: band, evidence_pending: true, criteria: [] },
    interview_guide: [],
    evidence: [],
    experience: [],
    skills: [],
    education: [],
    languages: [],
    certifications: [],
    work_authorization: null,
    screening_answers: [],
    compensation_alignment: { role_range: null, candidate_expectation: null, currency: null, cadence: "unknown", verdict: "unknown", note: null },
    source_trace: { source_label: null, applied_at: null, application_reference: null, channel: null, notes: null },
    audit_trail: [],
    action_items: [],
    recommended_next_step: null,
    next_step_deadline: null,
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
