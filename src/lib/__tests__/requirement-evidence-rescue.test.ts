import { describe, expect, it } from "vitest";
import { buildRequirementRows } from "@/lib/client-fit-presentation";

/**
 * The row-level-security case: the engine tagged the relevant quote to a
 * neighbouring nice-to-have, leaving the must-have with only generic passages.
 * The must-have must not read "not evidenced" while the same record quotes it.
 */
const mustLabel =
  "Practical experience with row-level security or another multi-tenant isolation model";
const prefLabel = "Worked on multi-tenant SaaS with per-tenant data isolation";
const rlsQuote =
  "Practical experience of the row-level security model that keeps 620 multi-tenant workspaces in strict isolation.";

describe("requirement evidence rescue", () => {
  it("evidences the must-have from a quote tagged to another requirement", () => {
    const coverage = {
      requirement_assessment: [
        { id: "must-0", text: mustLabel, status: "met" },
        { id: "pref-0", text: prefLabel, status: "met" },
      ],
    };
    const items = [{ requirement_id: "pref-0", source: "cv", snippet: rlsQuote }];
    const rows = buildRequirementRows(
      { requirements: [mustLabel], preferred_requirements: [prefLabel] },
      coverage,
      items,
    );
    const must = rows.find((r) => r.importance === "must_have")!;
    expect(["met", "partial"]).toContain(must.status);
    expect(must.evidence.map((e) => e.snippet).join(" ")).toContain("row-level security");
  });

  it("still reads not evidenced when the record says nothing about it", () => {
    const rows = buildRequirementRows(
      { requirements: [mustLabel], preferred_requirements: [] },
      { requirement_assessment: [{ id: "must-0", text: mustLabel, status: "met" }] },
      [{ requirement_id: "other", source: "cv", snippet: "Fluent in Portuguese and English." }],
    );
    expect(rows[0]!.status).toBe("not_evidenced");
  });
});
