import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { RequirementRow } from "@/lib/client-fit-presentation";

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;

/** Client-facing status vocabulary: met / partially met / unknown. */
export type CompareStatus = "met" | "partial" | "unknown" | "contradicted" | "not_applicable";

export type CompareCell = {
  match_id: string;
  status: CompareStatus;
  /** Evidence snippet revealed on hover — never a score or engine internal. */
  evidence: string | null;
  source: string | null;
};

export type CompareMatrixRow = {
  key: string;
  label: string;
  importance: RequirementRow["importance"];
  cells: CompareCell[];
  /** True when every candidate lands on the same status. */
  uniform: boolean;
};

function toStatus(s: RequirementRow["status"] | undefined): CompareStatus {
  if (s === "met") return "met";
  if (s === "partial") return "partial";
  if (s === "contradicted") return "contradicted";
  if (s === "not_applicable") return "not_applicable";
  return "unknown";
}

export const STATUS_LABEL: Record<CompareStatus, string> = {
  met: "Met",
  partial: "Partially met",
  unknown: "Unknown",
  contradicted: "Contradicted",
  not_applicable: "Not applicable",
};

/**
 * Requirement grid across 2–4 candidates on the same role.
 * Must-haves first, then preferred, alphabetical inside each group.
 */
export function buildCompareMatrix(candidates: ClientCandidateDTO[]): CompareMatrixRow[] {
  const order = new Map<string, { label: string; importance: RequirementRow["importance"] }>();
  for (const c of candidates) {
    for (const r of c.requirement_rows) {
      const key = `${r.importance}:${r.label.toLowerCase().trim()}`;
      if (!order.has(key)) order.set(key, { label: r.label.trim(), importance: r.importance });
    }
  }

  const rows: CompareMatrixRow[] = Array.from(order.entries()).map(([key, meta]) => {
    const cells: CompareCell[] = candidates.map((c) => {
      const row = c.requirement_rows.find(
        (x) =>
          x.importance === meta.importance &&
          x.label.toLowerCase().trim() === meta.label.toLowerCase(),
      );
      const ev = row?.evidence.find((e) => (e.snippet ?? "").trim().length > 0) ?? null;
      return {
        match_id: c.match_id,
        status: toStatus(row?.status),
        evidence: ev ? ev.snippet.trim() : (row?.explanation?.trim() || null),
        source: ev?.source ?? null,
      };
    });
    return {
      key,
      label: meta.label,
      importance: meta.importance,
      cells,
      uniform: cells.every((x) => x.status === cells[0].status),
    };
  });

  rows.sort((a, b) => {
    if (a.importance !== b.importance) return a.importance === "must_have" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return rows;
}

export type RubricGuard = {
  /** Rubric identity per candidate: blueprint + engine version. */
  versions: string[];
  mismatched: boolean;
  warning: string | null;
};

export function rubricVersion(c: ClientCandidateDTO): string {
  const blueprint = c.evaluation.blueprint_version?.trim() || "unversioned";
  const engine = c.evaluation.engine_version?.trim() || "unversioned";
  return `${blueprint} · ${engine}`;
}

/**
 * Comparing candidates assessed against different rubric versions can mean the
 * same requirement label was judged with different criteria. We still render
 * the grid, but say so explicitly.
 */
export function rubricGuard(candidates: ClientCandidateDTO[]): RubricGuard {
  const versions = Array.from(new Set(candidates.map(rubricVersion)));
  const mismatched = versions.length > 1;
  return {
    versions,
    mismatched,
    warning: mismatched
      ? "These candidates were assessed against different versions of this role's requirements, so the same requirement may have been judged differently. Compare the evidence in each cell rather than the pattern of ticks."
      : null,
  };
}

export type CompareEligibility = {
  ok: boolean;
  reason: string | null;
};

/** 2–4 candidates, single position. Anything else is refused with a reason. */
export function compareEligibility(candidates: ClientCandidateDTO[]): CompareEligibility {
  if (candidates.length < COMPARE_MIN) {
    return { ok: false, reason: `Select at least ${COMPARE_MIN} candidates to compare` };
  }
  if (candidates.length > COMPARE_MAX) {
    return { ok: false, reason: `Compare up to ${COMPARE_MAX} candidates at a time` };
  }
  const positions = new Set(candidates.map((c) => c.position?.id ?? "none"));
  if (positions.size > 1) {
    return { ok: false, reason: "Select candidates from the same position to compare" };
  }
  return { ok: true, reason: null };
}

/**
 * Default comparison set: the shortlist-ready candidates for the largest
 * single position, capped at COMPARE_MAX and ordered as delivered.
 */
export function defaultCompareSelection(candidates: ClientCandidateDTO[]): string[] {
  const eligible = candidates.filter(
    (c) => c.stage === "shortlisted" || c.stage === "delivered" || c.stage === "interview_process",
  );
  const byPosition = new Map<string, ClientCandidateDTO[]>();
  for (const c of eligible) {
    const key = c.position?.id ?? "none";
    byPosition.set(key, [...(byPosition.get(key) ?? []), c]);
  }
  let best: ClientCandidateDTO[] = [];
  for (const group of byPosition.values()) {
    const shortlisted = group.filter((c) => c.stage === "shortlisted");
    const pool = shortlisted.length >= COMPARE_MIN ? shortlisted : group;
    if (pool.length > best.length) best = pool;
  }
  if (best.length < COMPARE_MIN) return [];
  return best.slice(0, COMPARE_MAX).map((c) => c.match_id);
}
