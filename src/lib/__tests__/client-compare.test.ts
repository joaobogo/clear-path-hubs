import { describe, it, expect } from "vitest";
import {
  buildCompareMatrix,
  compareEligibility,
  rubricGuard,
  rubricVersion,
  defaultCompareSelection,
  COMPARE_MAX,
} from "@/lib/client-compare";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

function cand(
  id: string,
  opts: {
    position?: string;
    stage?: ClientCandidateDTO["stage"];
    rows?: Array<[string, "must_have" | "preferred", string, string?]>;
    blueprint?: string | null;
    engine?: string | null;
  } = {},
): ClientCandidateDTO {
  return {
    match_id: id,
    stage: opts.stage ?? "shortlisted",
    position: { id: opts.position ?? "pos-1", title: "Platform Engineer" },
    candidate: { display_name: id },
    requirement_rows: (opts.rows ?? []).map(([label, importance, status, snippet], i) => ({
      id: `${id}-${i}`,
      label,
      importance,
      status,
      explanation: null,
      evidence: snippet ? [{ source: "CV", snippet }] : [],
    })),
    evaluation: {
      blueprint_version: opts.blueprint ?? "bp-1",
      engine_version: opts.engine ?? "v2",
    },
  } as unknown as ClientCandidateDTO;
}

describe("client comparison", () => {
  it("builds a side-by-side grid with met / partially met / unknown per requirement", () => {
    const a = cand("Ana", {
      rows: [
        ["Kubernetes", "must_have", "met", "Ran 40-node EKS clusters"],
        ["Terraform", "must_have", "partial"],
      ],
    });
    const b = cand("Ben", {
      rows: [
        ["kubernetes", "must_have", "not_evidenced"],
        ["Mentoring", "preferred", "met", "Mentored 4 juniors"],
      ],
    });
    const m = buildCompareMatrix([a, b]);

    expect(m.map((r) => r.label)).toEqual(["Kubernetes", "Terraform", "Mentoring"]);
    expect(m[0].cells.map((c) => c.status)).toEqual(["met", "unknown"]);
    expect(m[0].cells[0].evidence).toBe("Ran 40-node EKS clusters");
    expect(m[0].uniform).toBe(false);
    // Missing rows read as unknown, never as met.
    expect(m[2].cells.map((c) => c.status)).toEqual(["unknown", "met"]);
    expect(m[1].cells[0].status).toBe("partial");
  });

  it("flags uniform rows so 'differences only' can hide them", () => {
    const rows: Array<[string, "must_have", string, string?]> = [["SQL", "must_have", "met", "x"]];
    const m = buildCompareMatrix([cand("Ana", { rows }), cand("Ben", { rows })]);
    expect(m[0].uniform).toBe(true);
  });

  it("warns explicitly when rubric versions differ", () => {
    const same = rubricGuard([cand("Ana"), cand("Ben")]);
    expect(same.mismatched).toBe(false);
    expect(same.warning).toBeNull();

    const mixed = rubricGuard([cand("Ana"), cand("Ben", { blueprint: "bp-2" })]);
    expect(mixed.mismatched).toBe(true);
    expect(mixed.warning).toMatch(/different versions/i);
    expect(mixed.versions).toHaveLength(2);
    expect(rubricVersion(cand("Ana"))).toBe("bp-1 · v2");
  });

  it("allows 2–4 candidates on one position only", () => {
    expect(compareEligibility([cand("A")]).reason).toMatch(/at least 2/);
    expect(compareEligibility([cand("A"), cand("B")]).ok).toBe(true);
    expect(
      compareEligibility([cand("A"), cand("B"), cand("C"), cand("D"), cand("E")]).reason,
    ).toMatch(/up to 4/);
    expect(compareEligibility([cand("A"), cand("B", { position: "pos-2" })]).reason).toMatch(
      /same position/,
    );
  });

  it("defaults the selection to the biggest shortlist, capped at 4", () => {
    const pool = [
      cand("A"),
      cand("B"),
      cand("C"),
      cand("D"),
      cand("E"),
      cand("F", { position: "pos-2" }),
    ];
    const sel = defaultCompareSelection(pool);
    expect(sel).toHaveLength(COMPARE_MAX);
    expect(sel).toEqual(["A", "B", "C", "D"]);
  });

  it("does not preselect when there is nothing to compare", () => {
    expect(defaultCompareSelection([cand("A")])).toEqual([]);
    expect(defaultCompareSelection([])).toEqual([]);
  });
});
