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
import { getEvidenceCounts } from "./evidence-counts";
import { hasRelatedSignal, resolveRequirementStatus } from "./requirement-status";
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
  /** Requirements with a related passage but no quote: possible signals. */
  related: number;
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
  // Same resolution the coverage panel and the header chip use, so the group
  // captions cannot claim evidence the requirement list does not show.
  const resolved = rows.map((r) => ({ row: r, status: resolveRequirementStatus(r) }));
  const met = resolved.filter((r) => r.status === "met").length;
  const partial = resolved.filter((r) => r.status === "partial").length;
  const missing = resolved.filter(
    (r) => r.status === "not_evidenced" || r.status === "contradicted",
  ).length;
  // Related-only rows carry no quote, so they are possible signals, not evidence.
  const related = resolved.filter((r) => hasRelatedSignal(r.row)).length;
  return { met, partial, missing, related };
}


function mustTakeaway(c: {
  met: number;
  partial: number;
  missing: number;
  related: number;
  total: number;
}) {
  if (c.total === 0) return "No must-haves were declared for this role.";
  const evidenced = c.met + c.partial;
  const signals = c.related > 0 ? ` ${plural(c.related, "possible signal")} not quoted.` : "";
  if (evidenced === 0) {
    return `None of the ${c.total} must-haves are quoted from the record yet.${signals}`;
  }
  if (c.missing > 0) {
    return `${plural(evidenced, "must-have")} of ${c.total} are quoted from the record; ${c.missing} ${pluralWord(c.missing, "carries", "carry")} no quote yet.${signals}`;
  }
  return `All ${c.total} must-haves are quoted directly from the CV or screening answers.${signals}`;
}

function preferredTakeaway(c: { met: number; partial: number; related: number; total: number }) {
  if (c.total === 0) return "No preferred requirements were declared for this role.";
  const evidenced = c.met + c.partial;
  const signals = c.related > 0 ? ` ${plural(c.related, "possible signal")} not quoted.` : "";
  if (evidenced === 0)
    return `None of the ${c.total} preferred requirements are quoted yet.${signals}`;
  return `${evidenced} of ${c.total} preferred requirements add to the ranking.${signals}`;
}


export function buildScoreBreakdown(candidate: ClientCandidateDTO): ScoreBreakdown {
  const rows = candidate.requirement_rows ?? [];
  const must = rows.filter((r: RequirementRow) => r.importance === "must_have");
  const preferred = rows.filter((r: RequirementRow) => r.importance !== "must_have");

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
  // We use the requirement ID to ensure mutual exclusivity.
  const reasonsByRequirement = new Map<string, BreakdownReason>();
  
  must
    .filter((r: RequirementRow) => resolveRequirementStatus(r) === "met")
    .slice(0, 3)
    .forEach((r: RequirementRow, i: number) => {
      const id = r.id || `must-met-${i}`;
      reasonsByRequirement.set(id, {
        id,
        tone: "positive",
        text: `Meets the must-have "${r.label}", quoted from ${
          r.evidence?.[0]?.source ?? "the application"
        }.`,
      });
    });

  (candidate.strengths ?? []).slice(0, 3).forEach((s: string, i: number) =>
    reasons.push({ id: `strength-${i}`, tone: "positive", text: s }),
  );

  must
    .filter((r: RequirementRow) => {
      const s = resolveRequirementStatus(r);
      return s === "not_evidenced" || s === "contradicted";
    })
    .slice(0, 3)
    .forEach((r: RequirementRow, i: number) => {
      const id = r.id || `must-gap-${i}`;
      // Deduplicate: if it's already in the positive list (which shouldn't happen 
      // with clean data, but we gate it here), or if it's already recorded.
      if (!reasonsByRequirement.has(id)) {
        reasonsByRequirement.set(id, {
          id,
          tone: "watch",
          text: `No evidence yet for the must-have "${r.label}" — this holds the score down.`,
        });
      }
    });

  // Also handle partials in the watch list if they are critical must-haves
  must
    .filter((r: RequirementRow) => resolveRequirementStatus(r) === "partial")
    .slice(0, 2)
    .forEach((r: RequirementRow, i: number) => {
      const id = r.id || `must-partial-${i}`;
      if (!reasonsByRequirement.has(id)) {
        reasonsByRequirement.set(id, {
          id,
          tone: "watch",
          text: `Only partial evidence for the must-have "${r.label}" — this holds the score down.`,
        });
      }
    });

  // Convert the map to the reasons list
  for (const reason of reasonsByRequirement.values()) {
    reasons.push(reason);
  }

  (candidate.concerns ?? []).slice(0, 3).forEach((c: string, i: number) =>
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
  // The criteria line must never contradict the header chip or the coverage
  // panel: it reads the same canonical evidenced total from the requirement
  // list, with quoted/related shown as separate labelled figures.
  const canonical = getEvidenceCounts(rows);
  const criteriaSummary =
    rows.length > 0
      ? `${canonical.evidenced} of ${canonical.total} requirements evidenced (quoted)${
          canonical.related > 0 ? ` — ${canonical.related} possible signals, not quoted` : ""
        }`
      : explanation && explanation.kind === "explained"
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
    reasons: cleanReasons(reasons).slice(0, 8),
    evidenceHash: "#sec-coverage",
    empty: rows.length === 0 && rubric.length === 0 && reasons.length === 0,
  };
}

/**
 * One reason per requirement, one line per sentence.
 * Drops entries whose sentence template was never filled in (a bare
 * requirement name, an empty label, or a fragment), and removes repeats
 * by requirement id and by wording.
 */
function cleanReasons(reasons: BreakdownReason[]): BreakdownReason[] {
  const seenIds = new Set<string>();
  const seenText = new Set<string>();
  const out: BreakdownReason[] = [];
  for (const r of reasons) {
    const text = (r.text ?? "").trim();
    if (!text) continue;
    // An unfilled template leaves empty quotes or a dangling dash.
    if (/""|“”|—\s*$|:\s*$/.test(text)) continue;
    // A complete sentence: several words and terminal punctuation.
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 4) continue;
    const sentence = /[.!?]$/.test(text) ? text : `${text}.`;
    const key = sentence.toLowerCase();
    const idKey = r.id ?? key;
    if (seenIds.has(idKey) || seenText.has(key)) continue;
    seenIds.add(idKey);
    seenText.add(key);
    out.push({ ...r, text: sentence });
  }
  return out;
}
