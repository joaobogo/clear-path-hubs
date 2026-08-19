import { describe, it, expect } from "vitest";
import { buildShortlistRationale, normaliseSource } from "@/lib/client-rationale";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { RequirementRow } from "@/lib/client-fit-presentation";

type Row = ClientCandidateDTO["requirement_rows"][number];

function row(p: Partial<RequirementRow> & { label: string }): RequirementRow {
  return {
    id: p.id ?? p.label,
    label: p.label,
    importance: p.importance ?? "must_have",
    status: p.status ?? "met",
    explanation: p.explanation ?? null,
    evidence: (p.evidence ?? []).map(e => ({ label: e.label || "Evidence", snippet: e.snippet, source: e.source ?? null })),
    interpretation: p.interpretation ?? null,
    contradictions: (p.contradictions ?? []).map(e => ({ label: e.label || "Contradiction", snippet: e.snippet, source: e.source ?? null })),
    context: (p.context ?? []).map(e => ({ label: e.label || "Context", snippet: e.snippet, source: e.source ?? null })),
  } as RequirementRow;
}

const base = {
  screening_answers: [] as Array<{ question: string; answer: string }>,
  evidence: [] as Array<{ label: string; snippet: string }>,
};

describe("shortlist rationale", () => {
  it("renders one line per intake requirement, must-haves first", () => {
    const r = buildShortlistRationale({
      ...base,
      requirement_rows: [
        row({ label: "Nice to have: Terraform", importance: "preferred", status: "met" }),
        row({ label: "Kubernetes", status: "met" }),
        row({ label: "On-call ownership", status: "not_evidenced" }),
      ],
    });
    expect(r.lines.map((l) => l.requirement)).toEqual([
      "Kubernetes",
      "On-call ownership",
      "Nice to have: Terraform",
    ]);
  });

  it("attributes every claim to a source the client recognises", () => {
    const r = buildShortlistRationale({
      ...base,
      requirement_rows: [
        row({
          label: "Kubernetes",
          evidence: [{ label: "Evidence", source: "resume", snippet: "Ran 40-node EKS clusters" }],
        }),
        row({
          label: "Team leadership",
          status: "partial",
          evidence: [{ label: "Evidence", source: "reference check with former VP", snippet: "Led a team of six" }],
        }),
      ],
    });
    expect(r.lines[0].claim).toBe("Ran 40-node EKS clusters");
    expect(r.lines[0].sources).toEqual(["CV"]);
    expect(r.lines[1].sources).toEqual(["Verified reference"]);
    expect(r.lines[1].verdictLabel).toBe("Partly meets this");
  });

  it("never claims a requirement without evidence", () => {
    const r = buildShortlistRationale({
      ...base,
      requirement_rows: [row({ label: "Fintech domain", status: "not_evidenced" })],
    });
    expect(r.lines[0].claim).toBeNull();
    expect(r.lines[0].sources).toEqual([]);
    expect(r.gaps.map((g) => g.requirement)).toEqual(["Fintech domain"]);
    expect(r.summary).toBe("0 of 1 of your requirements evidenced");
  });

  it("falls back to screening answers and recruiter notes, labelled as such", () => {
    const r = buildShortlistRationale({
      ...base,
      screening_answers: [{ question: "Notice period?", answer: "Kubernetes daily for 4 years" }],
      requirement_rows: [
        row({ label: "Kubernetes" }),
        row({ label: "Budget ownership", explanation: "Managed a 400k tooling budget" }),
      ],
    });
    expect(r.lines[0].sources).toEqual(["Application answers"]);
    expect(r.lines[1].sources).toEqual(["Recruiter notes"]);
    expect(r.lines[1].claim).toBe("Managed a 400k tooling budget");
  });

  it("reads contradicted requirements as not evidenced, never as a score", () => {
    const r = buildShortlistRationale({
      ...base,
      requirement_rows: [row({ label: "10 years experience", status: "contradicted" })],
    });
    expect(r.lines[0].verdict).toBe("gap");
    expect(JSON.stringify(r)).not.toMatch(/score|rubric|engine/i);
  });

  it("normalises unknown provenance conservatively", () => {
    expect(normaliseSource("screening call")).toBe("Screening call");
    expect(normaliseSource("cv")).toBe("CV");
    expect(normaliseSource("referee")).toBe("Verified reference");
    expect(normaliseSource(null)).toBe("Recruiter notes");
    expect(normaliseSource("mystery")).toBe("Recruiter notes");
  });

  it("excludes not-applicable requirements from the count", () => {
    const r = buildShortlistRationale({
      ...base,
      requirement_rows: [
        row({ label: "A", evidence: [{ label: "Evidence", source: "cv", snippet: "yes" }] }),
        row({ label: "B", status: "not_applicable" }),
      ],
    });
    expect(r.summary).toBe("1 of 1 of your requirements evidenced");
  });
});