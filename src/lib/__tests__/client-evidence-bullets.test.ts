import { describe, it, expect } from "vitest";
import {
  selectEvidenceBullets,
  unevidencedMustHaves,
  fitChips,
} from "@/lib/client-evidence-bullets";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

const rows = [
  {
    id: "1",
    label: "5+ years Kubernetes in production",
    importance: "must_have" as const,
    status: "met" as const,
    explanation: "Ran clusters at scale",
    evidence: [{ source: "CV", snippet: "Ran 40-node EKS clusters for 6 years at Acme" }],
  },
  {
    id: "2",
    label: "Team leadership",
    importance: "preferred" as const,
    status: "met" as const,
    explanation: null,
    evidence: [{ source: "CV", snippet: "Led a team of 8 engineers" }],
  },
  {
    id: "3",
    label: "Terraform",
    importance: "must_have" as const,
    status: "partial" as const,
    explanation: "Used Terraform on one project",
    evidence: [],
  },
  {
    id: "4",
    label: "Financial services background",
    importance: "must_have" as const,
    status: "not_evidenced" as const,
    explanation: null,
    evidence: [],
  },
];

const base = {
  requirement_rows: rows,
  evidence: [{ label: "Certification", snippet: "CKA certified 2024" }],
  strengths: ["Strong incident response record"],
} as unknown as ClientCandidateDTO;

describe("evidence-first candidate card data", () => {
  it("leads with must-have, fully met requirements", () => {
    const b = selectEvidenceBullets(base);
    expect(b).toHaveLength(3);
    expect(b[0].requirement).toBe("5+ years Kubernetes in production");
    expect(b[0].strength).toBe("verified");
    expect(b[0].detail).toContain("40-node EKS");
    // partial must-have outranks preferred? no — must-have met first, then partial must-have
    expect(b[1].requirement).toBe("Terraform");
    expect(b[1].strength).toBe("partial");
    expect(b[2].requirement).toBe("Team leadership");
  });

  it("never invents evidence for unevidenced requirements", () => {
    const b = selectEvidenceBullets(base);
    expect(b.some((x) => x.requirement === "Financial services background")).toBe(false);
    expect(unevidencedMustHaves(base)).toEqual(["Financial services background"]);
  });

  it("falls back to labelled evidence, then strengths", () => {
    const sparse = {
      requirement_rows: [],
      evidence: [{ label: "Certification", snippet: "CKA certified 2024" }],
      strengths: ["Strong incident response record"],
    } as unknown as ClientCandidateDTO;
    const b = selectEvidenceBullets(sparse);
    expect(b.map((x) => x.requirement)).toEqual(["Certification", "Strength"]);
  });

  it("exposes availability, location and compensation fit only", () => {
    const dto = {
      ...base,
      candidate: { availability: "2 weeks", location: "Lisbon", timezone: "WET" },
      compensation_alignment: {
        role_range: "€70–85k",
        candidate_expectation: "€78k",
        currency: "EUR",
        cadence: "year",
        verdict: "aligned",
        note: null,
      },
    } as unknown as ClientCandidateDTO;
    const chips = fitChips(dto);
    expect(chips.map((c) => c.label)).toEqual(["Available", "Based in", "Comp"]);
    expect(chips[1].value).toBe("Lisbon · WET");
    expect(chips[2].value).toBe("€78k · in range");
    expect(chips[2].tone).toBe("good");
  });

  it("omits chips with no data rather than guessing", () => {
    const dto = {
      ...base,
      candidate: { availability: null, location: null, timezone: null },
      compensation_alignment: { verdict: "unknown", candidate_expectation: null },
    } as unknown as ClientCandidateDTO;
    expect(fitChips(dto)).toEqual([]);
  });
});
