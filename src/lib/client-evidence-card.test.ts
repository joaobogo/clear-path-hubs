import { describe, expect, it } from "vitest";
import {
  buildEvidenceCard,
  formatEvidenceLocation,
  isShareableVerifiedEvidence,
  type ClientEvidenceRow,
} from "./client-evidence-card";

function row(over: Partial<ClientEvidenceRow> = {}): ClientEvidenceRow {
  return {
    id: over.id ?? "e1",
    rubric_criterion_key: "kubernetes_at_scale",
    rubric_dimension_key: "role_fit",
    result: "strong",
    match_type: "direct",
    factual_quote: "Ran a 40-node Kubernetes platform for 3 years",
    interpretation: "Operated Kubernetes at production scale for three years",
    source_kind: "cv",
    source_location: { page: 2, section: "Experience" },
    ...over,
  };
}

describe("isShareableVerifiedEvidence", () => {
  it("rejects internal notes and non-supporting rows", () => {
    expect(isShareableVerifiedEvidence(row({ source_kind: "internal_note" }))).toBe(false);
    expect(isShareableVerifiedEvidence(row({ match_type: "missing" }))).toBe(false);
    expect(isShareableVerifiedEvidence(row({ result: "contradictory" }))).toBe(false);
    expect(
      isShareableVerifiedEvidence(row({ interpretation: "", factual_quote: "" })),
    ).toBe(false);
    expect(isShareableVerifiedEvidence(row())).toBe(true);
  });
});

describe("formatEvidenceLocation", () => {
  it("names the document and where in it", () => {
    expect(formatEvidenceLocation(row())).toBe("CV · page 2 · Experience");
    expect(formatEvidenceLocation(row({ source_kind: "reference", source_location: null }))).toBe(
      "Verified reference",
    );
  });
});

describe("buildEvidenceCard", () => {
  it("returns at most three bullets, one per requirement, must-haves first", () => {
    const rows = [
      row({ id: "a", rubric_criterion_key: "kubernetes_at_scale" }),
      row({ id: "b", rubric_criterion_key: "kubernetes_at_scale", result: "partial", match_type: "adjacent" }),
      row({ id: "c", rubric_criterion_key: "team_leadership" }),
      row({ id: "d", rubric_criterion_key: "fintech_domain" }),
      row({ id: "e", rubric_criterion_key: "spanish" }),
    ];
    const card = buildEvidenceCard(rows, [
      { label: "Team leadership", importance: "must_have" },
      { label: "Kubernetes at scale", importance: "must_have" },
      { label: "Spanish", importance: "preferred" },
    ]);
    expect(card.bullets).toHaveLength(3);
    expect(card.bullets.map((b) => b.requirement).slice(0, 2).sort()).toEqual([
      "Kubernetes at scale",
      "Team leadership",
    ]);
    // Strongest row wins for a duplicated criterion.
    expect(card.bullets.some((b) => b.id === "b")).toBe(false);
    expect(card.summaryInProgress).toBe(false);
    expect(card.bullets[0]!.where.startsWith("CV")).toBe(true);
  });

  it("flags summary in progress with fewer than three verified bullets", () => {
    const card = buildEvidenceCard([row(), row({ id: "x", source_kind: "internal_note" })]);
    expect(card.bullets).toHaveLength(1);
    expect(card.summaryInProgress).toBe(true);
  });

  it("returns nothing when no verified evidence exists", () => {
    expect(buildEvidenceCard([]).bullets).toEqual([]);
    expect(buildEvidenceCard(null).summaryInProgress).toBe(true);
  });

  it("drops bullets that only repeat the requirement", () => {
    const rows = [
      row({ id: "a", rubric_criterion_key: "strong_sql", interpretation: "Strong SQL" }),
      row({ id: "b", rubric_criterion_key: "strong_sql", interpretation: "strong  sql" }),
      row({ id: "c", rubric_criterion_key: "team_lead", interpretation: "Team leadership: led a team of nine" }),
    ];
    const card = buildEvidenceCard(rows, [
      { label: "Strong SQL", importance: "must_have" },
      { label: "Team leadership", importance: "preferred" },
    ]);
    expect(card.bullets.map((b) => b.requirement)).toEqual(["Team leadership"]);
    expect(card.bullets.every((b) => b.claim !== b.requirement)).toBe(true);
  });
});
