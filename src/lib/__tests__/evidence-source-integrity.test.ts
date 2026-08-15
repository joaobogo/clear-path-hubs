import { describe, it, expect } from "vitest";
import { buildRequirementRows } from "../client-fit-presentation";
import { cleanQuote } from "../evidence/quote-hygiene";

describe("evidence source integrity", () => {
  const requirement = "Strong SQL and relational data modelling in Postgres";
  const sharedQuote = "…and a full regression suite. Delivered in phases with no downtime.";

  it("should not show evidence that does not exist in the candidate's own records", () => {
    // Mocking a situation where a requirement is 'met' but has no real evidence snippets.
    const position = { requirements: [requirement] };
    const coverage = {
      requirements: [
        {
          label: requirement,
          status: "met",
          evidence: [] // No evidence here
        }
      ]
    };

    const rows = buildRequirementRows(position, coverage, []);
    const row = rows.find(r => r.label === requirement);

    expect(row).toBeDefined();
    // If it has no evidence, it shouldn't show the shared quote
    expect(row?.evidence.map(e => e.snippet)).not.toContain(cleanQuote(sharedQuote));
  });

  it("identifies where the 'no direct evidence found' fallback should be used", () => {
    const position = { requirements: [requirement] };
    const coverage = {
      requirements: [{ label: requirement, status: "met", evidence: [] }]
    };

    const rows = buildRequirementRows(position, coverage, []);
    const row = rows.find(r => r.label === requirement);

    // Current implementation returns empty evidence array if none found
    expect(row?.evidence).toHaveLength(0);
  });

  it("ensures compare matrix does not reuse unrelated explanations", () => {
    const requirementLabel = "Strong SQL";
    const candidates: any[] = [
      {
        match_id: "c1",
        requirement_rows: [
          {
            label: requirementLabel,
            importance: "must_have",
            status: "met",
            evidence: [],
            explanation: "Generic explanation"
          }
        ]
      }
    ];

    const matrix = buildCompareMatrix(candidates);
    const cell = matrix[0].cells[0];

    // Should be null because there's no verbatim evidence
    expect(cell.evidence).toBeNull();
  });
});
