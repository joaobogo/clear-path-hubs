import { describe, it, expect } from "vitest";
import { buildValidationList, isRequirementShapedConcern } from "@/lib/client/validation-list";
import type { RequirementRow } from "@/lib/client-fit-presentation";

const row = (
  id: string,
  label: string,
  status: RequirementRow["status"],
  importance: RequirementRow["importance"] = "must_have",
): RequirementRow => ({ 
  id, 
  label, 
  importance, 
  status, 
  explanation: null, 
  evidence: [], 
  context: [],
  interpretation: null,
  contradictions: []
});

// The three demo profiles as rendered on /client/candidates/:id.
const MIGUEL: RequirementRow[] = [
  row("r1", "5+ years building production React and TypeScript applications", "met"),
  row("r2", "Fluent written and spoken English", "met"),
  row("r3", "Experience leading a small team", "partial"),
  row("r4", "AWS infrastructure ownership", "not_evidenced", "preferred"),
];

const PEDRO: RequirementRow[] = [
  row("r1", "5+ years building production React and TypeScript applications", "not_evidenced"),
  row("r2", "Fluent written and spoken English", "partial"),
  row("r3", "Design system contributions", "met", "preferred"),
];

const ANA: RequirementRow[] = [
  row("r1", "5+ years building production React and TypeScript applications", "partial"),
  row("r2", "Fluent written and spoken English", "contradicted"),
  row("r3", "Testing discipline", "not_applicable", "preferred"),
];

const STALE_CONCERNS = [
  "Only partial evidence for required: 5+ years building production React and TypeScript applications",
  "Insufficient evidence — validate: Fluent written and spoken English",
  "No evidence of required: Experience leading a small team",
  "Contradicting evidence for required: Fluent written and spoken English",
];

describe("buildValidationList", () => {
  it("drops requirement-shaped engine concerns that can contradict coverage", () => {
    for (const c of STALE_CONCERNS) expect(isRequirementShapedConcern(c)).toBe(true);
    expect(isRequirementShapedConcern("CV text could not be extracted with confidence.")).toBe(
      false,
    );
  });

  it("never lists a Met requirement by default", () => {
    const items = buildValidationList(MIGUEL, STALE_CONCERNS);
    const labels = items.map((i) => i.label);
    expect(labels).not.toContain("5+ years building production React and TypeScript applications");
    expect(labels).not.toContain("Fluent written and spoken English");
  });

  it("keeps run-level note that are not requirement restatements", () => {
    const items = buildValidationList(MIGUEL, [
      ...STALE_CONCERNS,
      "CV text could not be extracted with confidence.",
    ]);
    expect(items[0]?.sentence).toBe("CV text could not be extracted with confidence.");
    expect(items[0]?.label).toBeNull();
  });

  it("agrees with the coverage status for every listed requirement", () => {
    for (const rows of [MIGUEL, PEDRO, ANA]) {
      for (const item of buildValidationList(rows, STALE_CONCERNS)) {
        if (!item.label) continue;
        const source = rows.find((r) => r.id === item.id)!;
        expect(item.status).toBe(source.status);
        if (source.status === "partial") expect(item.sentence).toContain("partially evidenced");
        if (source.status === "not_evidenced")
          expect(item.sentence).toContain("no supporting evidence found");
        if (source.status === "contradicted") expect(item.sentence).toContain("conflicts");
      }
    }
  });
});