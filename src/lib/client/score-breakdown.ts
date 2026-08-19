/**
 * Score breakdown for the candidate profile — why this candidate ranks here.
 *
 * Pure presentation logic over the client DTO. Three parts, all grounded in
 * data already delivered to the workspace:
 *   1) must-have vs preferred requirement evidence
 *   2) rubric criteria with their weights (when the run stored them)
 *   3) the key reasons: what carried the score up, and what to watch
 *
 * No numbers are invented here. Anything the run did not store comes back as
 * an empty list so the surface can say so plainly.
 */
import { bandRange, classifyBand } from "@/lib/scoring/bands";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { RequirementRow } from "@/lib/client-fit-presentation";
import { plural, pluralWord } from "@/lib/format/plural";

export type BreakdownGroup = {
  kind: "must_have" | "preferred";
  title: string;
  rows: RequirementRow[];
  met: number;
  partial: number;
  missing: number;
  total: number;
  /** One line a hiring manager can read on its own. */
  takeaway: string;
};

export type RubricCriterion = {
  label: string;
  /** 0..100, or null when the run stored a weight but no measured value. */
  pct: number | null;
  /** 0..100 share of the rubric, or null when unweighted. */
  weightPct: number | null;
};

export type BreakdownReason = {
  id: string;
  tone: "positive" | "watch";
  text: string;
};

export type ScoreBreakdown = {
  /** The stored 0–100 fit score, or null when the run has none. */
  score: number | null;
  bandLabel: string;
  bandFloor: number | null;
  bandCeiling: number | null;
  methodLabel: string | null;
  criteriaSummary: string | null;
  scoredAt: string | null;
  groups: BreakdownGroup[];
  rubric: RubricCriterion[];
  reasons: BreakdownReason[];
  /** Where the evidence lives, for the "see the evidence" affordance. */
  evidenceHash: string;
  /** True when there is nothing meaningful to render. */
  empty: boolean;
};

function countRows(rows: RequirementRow[]) {
  const met = rows.filter((r) => r.status === "met").length;
  const partial = rows.filter((r) => r.status === "partial").length;
  const missing = rows.filter(
    (r) => r.status === "not_evidenced" || r.status === "contradicted",
  ).length;
  return { met, partial, missing };
}

function mustTakeaway(c: { met: number; partial: number; missing: number; total: number }) {
  if (c.total === 0) return "No must-haves were declared for this role.";
  if (c.missing > 0) {
    return `${plural(c.met, "must-have")} of ${c.total} are quoted from evidence; ${c.missing} ${pluralWord(c.missing, "carries", "carry")} none yet.`;
  }
  if (c.partial > 0) {
    return `${c.met} of ${c.total} must-haves are quoted directly, ${c.partial} only related.`;
  }
  return `All ${c.total} must-haves are quoted directly from the CV or screening answers.`;
}

function preferredTakeaway(c: { met: number; total: number }) {
  if (c.total === 0) return "No preferred requirements were declared for this role.";
  if (c.met === 0) return `None of the ${c.total} preferred requirements are evidenced yet.`;
  return `${c.met} of ${c.total} preferred requirements add to the ranking.`;
}

export function buildScoreBreakdown(candidate: ClientCandidateDTO): ScoreBreakdown {
  const rows = candidate.requirement_rows ?? [];
  const must = rows.filter((r) => r.importance === "must_have");
  const preferred = rows.filter((r) => r.importance !== "must_have");

  const mustCounts = { ...countRows(must), total: must.length };
  const prefCounts = { ...countRows(preferred), total: preferred.length };

  const groups: BreakdownGroup[] = [
    {
      kind: "must_have",
      title: "Must-have evidence",
      rows: must,
      ...mustCounts,
      takeaway: mustTakeaway(mustCounts),
    },
    {
      kind: "preferred",
      title: "Preferred evidence",
      rows: preferred,
      ...prefCounts,
      takeaway: preferredTakeaway(prefCounts),
    },
  ];

  const rubric: RubricCriterion[] = []; // Suppressed factor block — fix P-035.

  const reasons: BreakdownReason[] = [];
  // Strongest evidenced must-haves lead, because they decide the ranking.
  must
    .filter((r) => r.status === "met")
    .slice(0, 3)
    .forEach((r, i) =>
      reasons.push({
        id: `must-met-${r.id ?? i}`,
        tone: "positive",
        text: `Meets the must-have "${r.label}", quoted from ${
          r.evidence?.[0]?.source ?? "the application"
        }.`,
      }),
    );
  (candidate.strengths ?? []).slice(0, 3).forEach((s, i) =>
    reasons.push({ id: `strength-${i}`, tone: "positive", text: s }),
  );
  must
    .filter((r) => r.status === "not_evidenced" || r.status === "contradicted")
    .slice(0, 3)
    .forEach((r, i) =>
      reasons.push({
        id: `must-gap-${r.id ?? i}`,
        tone: "watch",
        text: `No evidence yet for the must-have "${r.label}" — this holds the score down.`,
      }),
    );
  (candidate.concerns ?? []).slice(0, 3).forEach((c, i) =>
    reasons.push({ id: `concern-${i}`, tone: "watch", text: c }),
  );
  if (candidate.main_consideration) {
    reasons.push({
      id: "main-consideration",
      tone: "watch",
      text: candidate.main_consideration,
    });
  }

  const band = classifyBand(candidate.score);
  const range = band === "unscored" ? null : bandRange(band);

  const explanation = candidate.explanation;
  const criteriaSummary =
    explanation && explanation.kind === "explained"
      ? explanation.criteria_summary
      : null;

  return {
    score: candidate.score ?? null,
    bandLabel: candidate.fit?.headline ?? "Not scored",
    bandFloor: range?.min ?? null,
    bandCeiling: range?.max ?? null,
    methodLabel: candidate.evaluation?.method_label ?? null,
    criteriaSummary,
    scoredAt: candidate.evaluation?.completed_at ?? candidate.last_updated ?? null,
    groups,
    rubric,
    reasons: reasons.slice(0, 8),
    evidenceHash: "#sec-coverage",
    empty: rows.length === 0 && rubric.length === 0 && reasons.length === 0,
  };
}
