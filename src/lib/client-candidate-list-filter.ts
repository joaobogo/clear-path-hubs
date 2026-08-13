// Pure filter + sort for the client candidate list.
//
// Extracted from the route so the drill-through predicates can be tested
// against the KPI definitions in client-kpi.server.ts. Every criterion is
// URL-driven, so this function is the single answer to "does the list agree
// with the chips and the tile that linked here?".
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

// Fit-band ordering for the "Highest approved fit" sort. Employer surfaces have
// no numeric rating to sort on — the band is the contract.
export const BAND_RANK: Record<string, number> = {
  exceptional: 5, strong: 4, good: 3, mixed: 2, limited: 1, not_recommended: 0,
};

export type CandidateListCriteria = {
  q: string;
  location: string;
  stage: string;
  fit: string;
  critical: string;
  review: string;
  availability: string;
  minExp: string;
  sort: string;
  /** KPI drill-through key ("top" | "interview_pipeline" | "all"). */
  filter: string;
  unicorn: string;
};

const STAGE_ORDER: Record<ClientCandidateDTO["stage"], number> = {
  delivered: 0,
  shortlisted: 1,
  interview_process: 2,
  offer: 3,
  hired: 4,
  not_moving_forward: 5,
};

/** Mirrors `isTopMatch` in client-kpi.server.ts via the presentation band. */
export function matchesTopTile(c: ClientCandidateDTO): boolean {
  return c.fit.band === "exceptional" || c.fit.band === "strong";
}

/**
 * Mirrors `isInInterview` in client-kpi.server.ts: an active interview counts
 * even when the stage has not been moved yet.
 */
export function matchesInterviewTile(c: ClientCandidateDTO): boolean {
  return c.interview_active || c.stage === "interview_process" || c.stage === "offer";
}

export function reviewGroup(c: ClientCandidateDTO): "awaiting" | "closed" | "in_progress" {
  if (c.stage === "delivered") return "awaiting";
  if (c.stage === "hired" || c.stage === "not_moving_forward") return "closed";
  return "in_progress";
}

export function filterCandidates(
  rows: ClientCandidateDTO[],
  s: CandidateListCriteria,
): ClientCandidateDTO[] {
  const q = s.q.trim().toLowerCase();
  const loc = s.location.trim().toLowerCase();
  return rows.filter((c) => {
    if (s.filter === "top" && !matchesTopTile(c)) return false;
    if (s.filter === "interview_pipeline" && !matchesInterviewTile(c)) return false;
    if (s.unicorn === "1" && !c.unicorn) return false;
    if (s.stage !== "all" && c.stage !== s.stage) return false;
    if (s.fit !== "all" && c.fit.band !== s.fit) return false;
    if (s.critical !== "all") {
      const missingEvidence = c.requirement_rows.some(
        (r: ClientCandidateDTO["requirement_rows"][number]) => r.importance === "must_have" && r.status === "not_evidenced",
      );
      const gaps = c.coverage.must_total > 0 && c.coverage.must_met < c.coverage.must_total;
      if (s.critical === "met" && (gaps || missingEvidence)) return false;
      if (s.critical === "gaps" && !gaps) return false;
      if (s.critical === "missing_evidence" && !missingEvidence) return false;
    }
    if (s.review !== "all" && reviewGroup(c) !== s.review) return false;
    if (s.availability !== "all" && (c.candidate.availability ?? "") !== s.availability) return false;
    if (s.minExp) {
      const min = Number(s.minExp);
      if (!Number.isNaN(min) && (c.candidate.years_experience ?? -1) < min) return false;
    }
    if (loc && !(c.candidate.location ?? "").toLowerCase().includes(loc)) return false;
    if (q) {
      const hay = [
        c.candidate.display_name,
        c.candidate.headline,
        c.candidate.location,
        c.position?.title,
        ...c.skills,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function sortCandidates(
  rows: ClientCandidateDTO[],
  sort: string,
): ClientCandidateDTO[] {
  const out = [...rows];
  out.sort((a, b) => {
    switch (sort) {
      case "score": {
        // Best score first; unscored candidates fall to the bottom, ordered by band.
        const as = a.score ?? -1;
        const bs = b.score ?? -1;
        if (bs !== as) return bs - as;
        return (BAND_RANK[b.fit.band] ?? 0) - (BAND_RANK[a.fit.band] ?? 0);
      }
      case "must": {
        const av = a.coverage.must_total ? a.coverage.must_met / a.coverage.must_total : 0;
        const bv = b.coverage.must_total ? b.coverage.must_met / b.coverage.must_total : 0;
        return bv - av;
      }
      case "stage":
        return STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage];
      case "name":
        return a.candidate.display_name.localeCompare(b.candidate.display_name);
      case "recent":
      default: {
        // Prioritise delivered (action required), then most recent.
        const ap = a.stage === "delivered" ? 0 : 1;
        const bp = b.stage === "delivered" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        const at = a.delivered_at ? new Date(a.delivered_at).getTime() : 0;
        const bt = b.delivered_at ? new Date(b.delivered_at).getTime() : 0;
        return bt - at;
      }
    }
  });
  return out;
}

export function filterAndSortCandidates(
  rows: ClientCandidateDTO[],
  s: CandidateListCriteria,
): ClientCandidateDTO[] {
  return sortCandidates(filterCandidates(rows, s), s.sort);
}
