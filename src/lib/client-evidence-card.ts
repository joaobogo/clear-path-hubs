/**
 * Shortlist card evidence bullets.
 *
 * Hard rules:
 *  - Bullets render only from verified, shareable evidence rows (the
 *    `candidate_evidence_client` view already filters to reviewer-accepted /
 *    edited rows with integrity_ok = true).
 *  - Each bullet names the requirement it addresses and where in the CV the
 *    claim was found.
 *  - No score, rank, percentile, confidence number or internal note is ever
 *    carried into a bullet.
 *  - Fewer than three verified bullets => the card is labelled
 *    "Summary in progress"; we never pad with unverified material.
 */

export type ClientEvidenceRow = {
  id: string;
  rubric_criterion_key: string | null;
  rubric_dimension_key?: string | null;
  result: string | null;
  match_type: string | null;
  /** Quoted from the source document. */
  factual_quote: string | null;
  /** Recruiter-verified reading of the quote. */
  interpretation: string | null;
  source_kind: string | null;
  source_ref?: string | null;
  source_location: unknown;
};

import { dropRequirementEcho } from "@/lib/client/card-assessment-state";
import { isTemplatedEvidence } from "@/lib/evidence/quote-hygiene";


export type EvidenceBullet = {
  id: string;
  /** The requirement this evidence addresses, in the client's words. */
  requirement: string;
  /** What the evidence shows — verified wording only. */
  claim: string;
  /** Where it was found, e.g. "CV · page 2". */
  where: string;
};

export type EvidenceCard = {
  bullets: EvidenceBullet[];
  /** True when fewer than three verified bullets exist. */
  summaryInProgress: boolean;
  verifiedCount: number;
};

export const EVIDENCE_BULLET_TARGET = 3;

/** Source kinds a client may see. Internal notes are never shareable. */
const SHAREABLE_SOURCE_KINDS = new Set([
  "cv",
  "resume",
  "application",
  "application_answers",
  "screening_call",
  "interview",
  "reference",
  "portfolio",
]);

/** Match types that actually support a requirement. */
const SUPPORTING_MATCH_TYPES = new Set(["direct", "semantic_equivalent", "adjacent"]);

/** Results that support a requirement. "missing"/"contradictory" never do. */
const SUPPORTING_RESULTS = new Set(["strong", "partial"]);

const SOURCE_LABELS: Record<string, string> = {
  cv: "CV",
  resume: "CV",
  application: "Application",
  application_answers: "Application answers",
  screening_call: "Screening call",
  interview: "Interview",
  reference: "Verified reference",
  portfolio: "Portfolio",
};

function clean(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max = 180): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

function humanise(key: string): string {
  const s = clean(key).replace(/[_.-]+/g, " ");
  if (!s) return "Requirement";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function slug(s: string): string {
  return clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** "CV · page 2" / "Screening call" — location text only, never a score. */
export function formatEvidenceLocation(row: ClientEvidenceRow): string {
  const base = SOURCE_LABELS[clean(row.source_kind).toLowerCase()] ?? "Record";
  const loc = row.source_location;
  const parts: string[] = [];
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const l = loc as Record<string, unknown>;
    const page = l.page ?? l.page_number;
    const section = l.section ?? l.heading ?? l.block;
    if (page != null && clean(page)) parts.push(`page ${clean(page)}`);
    if (section != null && clean(section)) parts.push(clean(String(section)));
  } else if (typeof loc === "string" && clean(loc)) {
    parts.push(clean(loc));
  }
  return parts.length > 0 ? `${base} · ${parts.slice(0, 2).join(" · ")}` : base;
}

export function isShareableVerifiedEvidence(row: ClientEvidenceRow): boolean {
  const kind = clean(row.source_kind).toLowerCase();
  if (!SHAREABLE_SOURCE_KINDS.has(kind)) return false;
  const match = clean(row.match_type).toLowerCase();
  if (match && !SUPPORTING_MATCH_TYPES.has(match)) return false;
  const result = clean(row.result).toLowerCase();
  if (result && !SUPPORTING_RESULTS.has(result)) return false;
  const quote = clean(row.factual_quote);
  if (quote && isTemplatedEvidence(quote)) return false;
  return Boolean(clean(row.interpretation) || quote);
}

/**
 * Build up to three bullets, one per requirement, strongest first.
 * `requirementLabels` maps a criterion key (or its slug) to the requirement
 * text captured at intake, so bullets read in the client's own language.
 */
export function buildEvidenceCard(
  rows: ClientEvidenceRow[] | null | undefined,
  requirementLabels?: Array<{ label: string; importance?: "must_have" | "preferred" }>,
): EvidenceCard {
  const labelBySlug = new Map<string, string>();
  const mustSlugs = new Set<string>();
  for (const r of requirementLabels ?? []) {
    const s = slug(r.label);
    if (!s) continue;
    labelBySlug.set(s, r.label);
    if (r.importance === "must_have") mustSlugs.add(s);
  }

  const usable = (rows ?? []).filter(isShareableVerifiedEvidence);

  // One bullet per requirement: keep the strongest row for each criterion.
  const byCriterion = new Map<string, ClientEvidenceRow>();
  const rank = (r: ClientEvidenceRow) => {
    const result = clean(r.result).toLowerCase();
    const match = clean(r.match_type).toLowerCase();
    return (result === "strong" ? 2 : 1) + (match === "direct" ? 1 : 0);
  };
  for (const row of usable) {
    const key = clean(row.rubric_criterion_key) || row.id;
    const current = byCriterion.get(key);
    if (!current || rank(row) > rank(current)) byCriterion.set(key, row);
  }

  const ordered = [...byCriterion.entries()].sort((a, b) => {
    const aMust = mustSlugs.has(slug(a[0])) ? 1 : 0;
    const bMust = mustSlugs.has(slug(b[0])) ? 1 : 0;
    if (aMust !== bMust) return bMust - aMust;
    return rank(b[1]) - rank(a[1]);
  });

  const bullets: EvidenceBullet[] = ordered
    .slice(0, EVIDENCE_BULLET_TARGET)
    .map(([key, row]) => {
      const requirement = labelBySlug.get(slug(key)) ?? humanise(key);
      // "requirement — the proof", never the requirement twice. Only the
      // recruiter's written reading may be shown here: raw CV slices can carry
      // contact details, which clients see only at interview stage with
      // consent. When the reading just restates the criterion there is no
      // distinct proof to add, so the line stands alone with its source
      // attribution rather than repeating itself.
      let claim = dropRequirementEcho(requirement, truncate(clean(row.interpretation)));
      // Catch readings that are only the requirement (case/whitespace-insensitive).
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!claim || norm(claim) === norm(requirement)) {
        claim = "";
      }
      return {
        id: row.id,
        requirement,
        claim,
        where: formatEvidenceLocation(row),
      };
    })
    .filter((b) => b.claim);

  return {
    bullets,
    summaryInProgress: bullets.length < EVIDENCE_BULLET_TARGET,
    verifiedCount: byCriterion.size,
  };
}
