/**
 * The role story: three figures that explain a search, each with the criteria
 * behind it and a path to the evidence.
 *
 *  1. Requirement coverage across the shortlist — met / partial / missing.
 *  2. Fit distribution of delivered candidates — bands, not adjectives.
 *  3. The next milestone — what the role is waiting on right now.
 *
 * Every block carries a takeaway sentence. A figure with nothing behind it says
 * so in words instead of drawing an empty chart.
 */

import type { RequirementRow, RequirementStatus } from "@/lib/client-fit-presentation";
import { SCORE_BAND_BOUNDARIES, bandRange, classifyBand, type ScoreBandKey } from "@/lib/scoring/bands";
import { bandByKey } from "@/config/scoring-bands";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

/** One assessed candidate, reduced to what the story needs. */
export type StoryCandidate = {
  match_id: string;
  name: string | null;
  stage: string;
  score: number | null;
  requirement_rows: RequirementRow[];
};

export type RequirementCoverageRow = {
  id: string;
  label: string;
  importance: "must_have" | "preferred";
  met: number;
  partial: number;
  missing: number;
  assessed: number;
  /** Candidates who fully evidence this requirement — the path to the proof. */
  met_names: string[];
};

export type CoverageBlock = {
  shortlist_size: number;
  requirements: RequirementCoverageRow[];
  met: number;
  partial: number;
  missing: number;
  checks: number;
  criteria: string;
  takeaway: string;
};

export type DistributionBand = {
  key: ScoreBandKey;
  label: string;
  min: number;
  max: number;
  count: number;
};

export type DistributionBlock = {
  delivered: number;
  scored: number;
  bandTotal: number;
  bands: DistributionBand[];
  criteria: string;
  takeaway: string;
};

export type MilestoneBlock = {
  headline: string;
  detail: string;
  criteria: string;
};

export type RoleStory = {
  coverage: CoverageBlock;
  distribution: DistributionBlock;
  milestone: MilestoneBlock;
};

/** Stages that count as "on the shortlist" — someone the client is acting on. */
export const SHORTLIST_STAGES = [
  "shortlisted",
  "interview_process",
  "offer",
  "hired",
] as const;

function isShortlistStage(stage: string): boolean {
  return (SHORTLIST_STAGES as readonly string[]).includes(stage);
}

function bucket(status: RequirementStatus): "met" | "partial" | "missing" | null {
  if (status === "met") return "met";
  if (status === "partial") return "partial";
  if (status === "not_evidenced" || status === "contradicted") return "missing";
  return null; // not_applicable was never in scope
}

const firstName = (name: string | null): string =>
  String(name ?? "").trim().split(/\s+/)[0] || "This candidate";

/**
 * Requirement coverage across the shortlist. Every declared requirement gets a
 * row even when no candidate evidences it, so a gap is visible rather than
 * absent. Falls back to delivered candidates when nothing is shortlisted yet.
 */
export function buildCoverage(candidates: StoryCandidate[]): CoverageBlock {
  const shortlist = candidates.filter((c) => isShortlistStage(c.stage));
  const pool = shortlist.length > 0 ? shortlist : candidates;
  const usingShortlist = shortlist.length > 0;

  const order: string[] = [];
  const byId = new Map<string, RequirementCoverageRow>();

  for (const cand of pool) {
    for (const row of cand.requirement_rows) {
      const b = bucket(row.status);
      if (b === null) continue;
      let agg = byId.get(row.id);
      if (!agg) {
        agg = {
          id: row.id,
          label: row.label,
          importance: row.importance,
          met: 0,
          partial: 0,
          missing: 0,
          assessed: 0,
          met_names: [],
        };
        byId.set(row.id, agg);
        order.push(row.id);
      }
      agg[b] += 1;
      agg.assessed += 1;
      if (b === "met" && agg.met_names.length < 4) agg.met_names.push(firstName(cand.name));
    }
  }

  const requirements = order
    .map((id) => byId.get(id)!)
    // Must-haves first, then the requirement with the most missing proof.
    .sort((a, b) => {
      if (a.importance !== b.importance) return a.importance === "must_have" ? -1 : 1;
      return b.missing + b.partial - (a.missing + a.partial);
    });

  const met = requirements.reduce((n, r) => n + r.met, 0);
  const partial = requirements.reduce((n, r) => n + r.partial, 0);
  const missing = requirements.reduce((n, r) => n + r.missing, 0);
  const checks = met + partial + missing;

  const criteria = usingShortlist
    ? `Every declared requirement checked against each of the ${pool.length} candidate${pool.length === 1 ? "" : "s"} you are acting on. Met means a direct quote from the CV or screening; partial means related but not conclusive; missing means no evidence found yet.`
    : `Every declared requirement checked against each of the ${pool.length} candidate${pool.length === 1 ? "" : "s"} delivered so far — nobody is shortlisted yet. Met means a direct quote; partial means related but not conclusive; missing means no evidence found yet.`;

  let takeaway: string;
  if (pool.length === 0 || checks === 0) {
    takeaway = "No requirement checks yet — coverage appears here with your first assessed candidate.";
  } else {
    const weakest = [...requirements]
      .filter((r) => r.importance === "must_have" || requirements.every((x) => x.importance === "preferred"))
      .sort((a, b) => b.missing - a.missing)[0];
    // Two figures, because the candidate cards count partial as support: a
    // low "fully evidenced" number next to "10 of 10 supported" would read as
    // a contradiction without the partial count beside it.
    const supported = met + partial;
    // Naming the weakest requirement makes the number actionable.
    const gap =
      weakest && weakest.missing > 0
        ? ` The widest gap is ${weakest.label}, unevidenced for ${weakest.missing} of the ${weakest.assessed} candidate${weakest.assessed === 1 ? "" : "s"} checked.`
        : "";
    takeaway = `${supported} of ${checks} requirement checks (${met} evidenced, ${partial} partial) are supported by direct evidence from the shortlist's CVs and screening answers.${gap}`;
  }

  return {
    shortlist_size: pool.length,
    requirements,
    met,
    partial,
    missing,
    checks,
    criteria,
    takeaway,
  };
}

/**
 * Fit distribution of delivered candidates. Bands come from the one canonical
 * band table, so the ranges shown here match every score on the candidate list.
 */
export function buildDistribution(candidates: StoryCandidate[]): DistributionBlock {
  const counts = new Map<ScoreBandKey, number>();
  let scored = 0;
  for (const c of candidates) {
    const band = classifyBand(c.score);
    if (band === "unscored") continue;
    scored += 1;
    counts.set(band, (counts.get(band) ?? 0) + 1);
  }

  const bands: DistributionBand[] = SCORE_BAND_BOUNDARIES.map((b) => {
    const range = bandRange(b.key);
    return {
      key: b.key,
      label: bandByKey(b.key).shortLabel,
      min: range.min,
      max: range.max,
      count: counts.get(b.key) ?? 0,
    };
  }).reverse();

  const bandTotal = bands.reduce((sum, b) => sum + b.count, 0);

  // Invariant: every scored candidate must land in exactly one of the five
  // canonical bands. If this fails, the bucketing logic has dropped or
  // double-counted a score, so fail loudly in development and log in prod.
  if (bandTotal !== scored) {
    const message = `Role story distribution mismatch: bandTotal=${bandTotal} scored=${scored} delivered=${candidates.length}`;
    if (import.meta.env.DEV) {
      throw new Error(message);
    }
    // eslint-disable-next-line no-console
    console.warn(message);
  }

  const strong = bands
    .filter((b) => b.min >= 70)
    .reduce((n, b) => n + b.count, 0);

  const criteria =
    "Every candidate delivered to you, placed by their evidenced fit score out of 100. Bands are fixed: 95+ exceptional, 85+ top, 70+ strong, 50+ consider, below 50 not recommended.";

  const strongPct = Math.round((strong / Math.max(1, scored)) * 100);
  const takeaway = scored > 0
    ? `${strong} of ${scored} delivered candidates score 70 or above (Strong or better), which is where we recommend a conversation.`
    : "No scored candidates yet — the spread appears with the first assessed candidate.";

  return { delivered: candidates.length, scored, bandTotal, bands, criteria, takeaway };
}

/** What the role is waiting on right now, and why we say so. */
export function buildMilestone(input: {
  status: string;
  candidates: StoryCandidate[];
  nextInterviewAt: string | null;
  firstShortlistExpectedAt: string | null;
  openings: number;
  hires: number;
}): MilestoneBlock {
  const { status, candidates, nextInterviewAt } = input;
  const at = (iso: string | null) =>
    iso
      ? formatDate(iso)
      : null;
  const count = (stage: string) => candidates.filter((c) => c.stage === stage).length;

  if (status === "draft" || status === "submitted" || status === "under_review") {
    return {
      headline: "We are finishing your role brief",
      detail: "Sourcing starts as soon as the brief is approved.",
      criteria: "Based on the role status recorded at intake.",
    };
  }
  if (status === "needs_clarification") {
    return {
      headline: "We need one answer from your team",
      detail: "Open the information request above — sourcing continues once it is answered.",
      criteria: "Based on the open information requests on this role.",
    };
  }
  if (status === "paused") {
    return {
      headline: "This role is paused",
      detail: "Nothing is being sourced while it stays paused.",
      criteria: "Based on the role status.",
    };
  }
  const isClosed = status === "closed" || status === "archived";
  const isFilled = input.hires >= input.openings && input.openings > 0;
  const hasActivePipeline = count("offer") > 0 || nextInterviewAt || count("interview_process") > 0;

  // A role is only "Complete" if it's closed/filled AND has no active interviews or offers outstanding.
  if ((isClosed || isFilled) && !hasActivePipeline) {
    return {
      headline: "This role is complete",
      detail: `${input.hires} of ${input.openings} opening${input.openings === 1 ? "" : "s"} filled.`,
      criteria: "Based on confirmed hires against the openings on this role.",
    };
  }

  if (count("offer") > 0) {
    return {
      headline: "Waiting on an offer response",
      detail: `${count("offer")} offer${count("offer") === 1 ? "" : "s"} outstanding. We chase daily and post the answer here.`,
      criteria: "Based on candidates currently at offer stage.",
    };
  }
  if (nextInterviewAt) {
    return {
      headline: `Next interview ${at(nextInterviewAt)}`,
      detail: "Scorecards land here within a day of each conversation.",
      criteria: "Based on the earliest scheduled interview on this role.",
    };
  }
  if (count("interview_process") > 0) {
    return {
      headline: "Interview times to confirm",
      detail: `${count("interview_process")} candidate${count("interview_process") === 1 ? "" : "s"} in the interview stage without a confirmed slot.`,
      criteria: "Based on candidates in the interview stage with no scheduled time.",
    };
  }
  if (count("delivered") > 0) {
    return {
      headline: `${count("delivered")} candidate${count("delivered") === 1 ? "" : "s"} waiting on your review`,
      detail: "Shortlist or decline each one; we source against your decisions.",
      criteria: "Based on delivered candidates with no decision recorded.",
    };
  }
  const expected = at(input.firstShortlistExpectedAt);
  return {
    headline: expected ? `First candidates expected ${expected}` : "Sourcing in progress",
    detail: expected
      ? "You get an email the moment the first shortlist is ready."
      : "No date is committed on this role yet — we will confirm one with you.",
    criteria: expected
      ? "Based on the delivery commitment recorded for this role."
      : "No delivery commitment stored for this role.",
  };
}

export function buildRoleStory(input: {
  status: string;
  candidates: StoryCandidate[];
  nextInterviewAt: string | null;
  firstShortlistExpectedAt: string | null;
  openings: number;
  hires: number;
}): RoleStory {
  return {
    coverage: buildCoverage(input.candidates),
    distribution: buildDistribution(input.candidates),
    milestone: buildMilestone(input),
  };
}
