import { describe, expect, it } from "vitest";
import { toClientCandidateDTO } from "@/lib/client-kpi.server";
import { EMPLOYER_VIEW_FIELDS } from "@/lib/candidate/employer-view";

/**
 * Anti-drift guard for the candidate "What employers see" preview.
 *
 * The preview is rendered from EMPLOYER_VIEW_FIELDS over the real employer DTO.
 * If a field is added to (or removed from) the client DTO without describing it
 * here, this test fails — so the preview always changes in the same release.
 */
const sampleRow = {
  id: "11111111-1111-1111-1111-111111111111",
  stage: "delivered",
  delivered_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-03T00:00:00Z",
  candidate_profiles: {
    id: "22222222-2222-2222-2222-222222222222",
    full_name: "Ada Lovelace",
    headline: "Backend engineer",
    location: "Lisbon, PT",
    timezone: "Europe/Lisbon",
    availability: "Two weeks",
    years_experience: 8,
    summary: "Builds payment systems.",
    experience: [{ title: "Engineer", company: "Acme" }],
    skills: ["Go", "Postgres"],
    education: [{ degree: "BSc", institution: "UL" }],
    languages: [{ name: "English", level: "Fluent" }],
    work_authorization: "EU citizen",
    linkedin_url: "https://linkedin.com/in/example",
    portfolio_url: null,
    certifications: [{ name: "AWS SAA" }],
    compensation_preferences: { target: 90000, currency: "EUR" },
  },
  positions: {
    id: "33333333-3333-3333-3333-333333333333",
    title: "Senior Backend Engineer",
    requirements: ["Go"],
    preferred_requirements: ["Kafka"],
    compensation: { min: 80000, max: 100000, currency: "EUR" },
  },
  applications: { id: "44444444-4444-4444-4444-444444444444", source: "job_board", applied_at: "2026-01-01T00:00:00Z" },
  score_runs: { score: 78, fit_label: "Strong", explanation: "Good coverage." },
  application_answers: [],
  audit_events: [],
  evidence_items: [],
};

describe("employer view manifest", () => {
  const dtoKeys = Object.keys(toClientCandidateDTO(sampleRow)).sort();
  const manifestKeys = EMPLOYER_VIEW_FIELDS.map((f) => f.key).sort();

  it("describes every field the employer DTO sends", () => {
    expect(manifestKeys).toEqual(dtoKeys);
  });

  it("describes each field exactly once", () => {
    expect(new Set(manifestKeys).size).toBe(manifestKeys.length);
  });
});
