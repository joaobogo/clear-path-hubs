import { describe, expect, it } from "vitest";
import { toClientCandidateDTO } from "@/lib/client-kpi.server";

function row(over: Record<string, unknown> = {}) {
  return {
    id: "m1",
    stage: "delivered",
    delivered_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    candidate_profiles: { full_name: "Ada Lovelace", updated_at: "2026-01-01T00:00:00Z" },
    positions: { id: "p1", title: "Engineer", requirements: [], preferred_requirements: [] },
    score_runs: {
      score: 73,
      // Written under older cut-offs — must not win over the number.
      fit_label: "worth_considering",
      fit_band: "worth_considering",
      completed_at: "2026-01-02T00:00:00Z",
      evidence: [
        {
          label: "Contact",
          snippet: "rques@demo.taasflow.com · +351 912 000 103",
        },
        {
          label: "Stack",
          snippet:
            "ada@demo.taasflow.com · +351 912 000 104 Core stack: TypeScript, React, Node.js and Postgres.",
        },
      ],
    },
    ...over,
  };
}

describe("client candidate DTO score truth", () => {
  it("derives the fit band from the run's score, not the stored label", () => {
    const dto = toClientCandidateDTO(row() as never);
    expect(dto.score).toBe(73);
    expect(dto.fit.band).toBe("strong");
  });

  it("uses the stored label only when the run has no score", () => {
    const dto = toClientCandidateDTO(
      row({ score_runs: { score: null, fit_label: "worth_considering" } }) as never,
    );
    expect(dto.score).toBeNull();
    expect(dto.fit.band).toBe("mixed");
  });

  it("scrubs contact details out of evidence snippets", () => {
    const dto = toClientCandidateDTO(row() as never) as unknown as {
      evidence?: Array<{ snippet: string }>;
    };
    const all = JSON.stringify(dto);
    expect(all).not.toContain("demo.taasflow.com");
    expect(all).not.toContain("912 000 103");
  });

  it("marks a 95+ score as a standout regardless of the stored band string", () => {
    const dto = toClientCandidateDTO(
      row({ score_runs: { score: 96, fit_band: "worth_considering", completed_at: null } }) as never,
    );
    expect(dto.unicorn).toBe(true);
  });
});
