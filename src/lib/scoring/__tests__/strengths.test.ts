import { describe, expect, it } from "vitest";
import { deriveStrengths, type StrengthAssessmentRow } from "@/lib/scoring/strengths";

const row = (over: Partial<StrengthAssessmentRow>): StrengthAssessmentRow => ({
  text: "Fluent professional English",
  status: "partial",
  evidence: [{ snippet: "Fluent in English" }],
  ...over,
});

describe("deriveStrengths", () => {
  it("lists fully met requirements first", () => {
    const out = deriveStrengths([
      row({ text: "B2B SaaS depth", status: "partial" }),
      row({ text: "Design-system ownership", status: "met" }),
    ]);
    expect(out[0]).toBe("Demonstrated: Design-system ownership");
  });

  /**
   * The bug this module exists for: a candidate whose criteria are all
   * partially evidenced scored 56, showed "Evidenced" badges and 88% evidence
   * confidence, and still rendered "Strengths: None surfaced."
   */
  it("surfaces partially evidenced requirements instead of showing nothing", () => {
    const out = deriveStrengths([
      row({ text: "Fluent professional English" }),
      row({ text: "Troubleshoots independently" }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe("Evidence found, pending confirmation: Fluent professional English");
  });

  it("stays silent when a partial requirement has no evidence behind it", () => {
    const out = deriveStrengths([
      row({ status: "partial", evidence: [] }),
      row({ status: "missing", evidence: [] }),
      row({ status: "unknown", evidence: null }),
      row({ status: "contradicted", evidence: [] }),
    ]);
    expect(out).toEqual([]);
  });

  it("never claims a contradicted or missing requirement as a strength", () => {
    const out = deriveStrengths([
      row({ text: "Denied outright", status: "contradicted", evidence: [{ s: 1 }] }),
      row({ text: "Absent", status: "missing", evidence: [{ s: 1 }] }),
    ]);
    expect(out).toEqual([]);
  });

  it("caps the list so it stays readable", () => {
    const many = Array.from({ length: 9 }, (_, i) => row({ text: `Requirement ${i}` }));
    expect(deriveStrengths(many)).toHaveLength(5);
  });
});
