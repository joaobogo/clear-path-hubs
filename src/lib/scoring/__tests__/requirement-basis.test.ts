/**
 * The caption under a percentage must describe the list beneath it.
 *
 * requirementBasis classified on the raw `status` column while the rendered
 * requirement list classifies through resolveRequirementStatus — which
 * downgrades a "met" row carrying no quoted passage to "not evidenced",
 * because a verdict without a quote is not evidence. The two therefore counted
 * different things, and the caption claimed to explain a list it had not read
 * (audit #8, TF8-06).
 */
import { describe, expect, it } from "vitest";
import { requirementBasis, formatBasis } from "@/lib/scoring/score-composition";
import { resolveRequirementStatus } from "@/lib/client/requirement-status";

const quote = [{ source: "cv", snippet: "Ran the platform for six years." }];

const req = (over: Record<string, unknown> = {}) => ({
  id: String(Math.abs(Number(over.id ?? 1))),
  label: "Requirement",
  importance: "must_have",
  status: "met",
  evidence: quote,
  ...over,
});

describe("requirementBasis counts what the list shows", () => {
  it("weights a partial as half a point", () => {
    const b = requirementBasis(
      [req({ id: 1 }), req({ id: 2, status: "partial" })],
      "must_have",
    )!;
    expect(b.points).toBe(1.5);
    expect(b.max).toBe(2);
    expect(b.valuePct).toBe(75);
    expect(formatBasis(b)).toBe("1.5 of 2 weighted points");
  });

  it("does not count a met requirement that carries no quote", () => {
    // The rendered list calls this "Not evidenced"; the basis used to call it
    // met, so the caption and the list disagreed on the same card.
    const rows = [req({ id: 1 }), req({ id: 2, status: "met", evidence: [] })];
    expect(resolveRequirementStatus(rows[1]!)).toBe("not_evidenced");

    const b = requirementBasis(rows, "must_have")!;
    expect(b.met).toBe(1);
    expect(b.missing).toBe(1);
    expect(b.valuePct).toBe(50);
  });

  it("agrees with resolveRequirementStatus on every row", () => {
    const rows = [
      req({ id: 1, status: "met" }),
      req({ id: 2, status: "partial" }),
      req({ id: 3, status: "met", evidence: [] }),
      req({ id: 4, status: "contradicted" }),
    ];
    const b = requirementBasis(rows, "must_have")!;
    const resolved = rows.map((r) => resolveRequirementStatus(r));

    expect(b.met).toBe(resolved.filter((s) => s === "met").length);
    expect(b.partial).toBe(resolved.filter((s) => s === "partial").length);
    expect(b.met + b.partial + b.missing).toBe(b.total);
  });

  it("excludes not_applicable rows from the denominator", () => {
    const b = requirementBasis(
      [req({ id: 1 }), req({ id: 2, status: "not_applicable" })],
      "must_have",
    )!;
    expect(b.total).toBe(1);
    expect(b.valuePct).toBe(100);
  });

  it("never reports full marks while a requirement is unevidenced", () => {
    // Filipe Rocha's card read "Must-have coverage 100% · 60 pts" beside
    // "5 of 6 evidenced" and a panel naming the sixth. Whatever the assessment
    // says, the basis derived from the list cannot be 100% here.
    const rows = [
      ...[1, 2, 3, 4, 5].map((id) => req({ id })),
      req({ id: 6, status: "met", evidence: [] }),
    ];
    const b = requirementBasis(rows, "must_have")!;
    expect(b.valuePct).toBeLessThan(100);
    expect(b.missing).toBeGreaterThan(0);
  });

  it("returns null when there is nothing of that importance", () => {
    expect(requirementBasis([], "must_have")).toBeNull();
    expect(requirementBasis([req({ importance: "preferred" })], "must_have")).toBeNull();
  });
});
