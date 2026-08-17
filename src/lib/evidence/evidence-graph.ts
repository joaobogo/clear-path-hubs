/**
 * Evidence Graph — read-only projection of existing scoring + evidence records.
 *
 * Chain modelled: requirement → candidate evidence → source/quote → scoring rule
 * → score contribution → decision impact.
 *
 * This module NEVER recomputes or mutates scores. It reads:
 *  - score_runs.result.requirement_assessment  (src/lib/scoring-engine.server.ts)
 *  - candidate_evidence.extracted.insights.requirement_verdicts
 *  - candidate_evidence_items rows (quotes, reviewer status, stored confidence)
 * and restates the weights already applied by the engine
 * (must-have 0.6, preferred 0.2, screening 0.2 — scoring-engine.server.ts:292).
 */

/** Status credit used by the scoring engine (scoring-engine.server.ts:270-277). */
export const STATUS_CREDIT: Record<RequirementStatus, number> = {
  met: 1,
  partial: 0.5,
  unknown: 0.4,
  missing: 0,
  contradicted: 0,
};

/** Block weights applied to the final score (scoring-engine.server.ts:292). */
export const BLOCK_WEIGHT_PCT = {
  must_have: 60,
  preferred: 20,
  screening: 20,
} as const;

export type RequirementStatus =
  | "met"
  | "partial"
  | "missing"
  | "unknown"
  | "contradicted";

/** How the evidence behind a requirement should be read by a human. */
export type EvidenceState =
  | "verified" // a verbatim source passage exists
  | "missing" // no evidence found in CV or screening answers
  | "conflicting" // CV and screening answers disagree, or evidence marked contradictory
  | "user_confirmed" // a reviewer accepted or edited the evidence
  | "system_interpretation"; // model wrote a reading, but no verbatim quote is attached

export type EvidenceSource = {
  kind: string; // "cv" | "screening" | source_kind from candidate_evidence_items
  location: string | null; // e.g. "cv:1200-1280", "screening:<qid>"
  quote: string | null; // verbatim passage, never paraphrased
};

export type EvidenceChainNode = {
  id: string;
  requirement: string;
  required: boolean;
  importanceLabel: string;
  blockKey: keyof typeof BLOCK_WEIGHT_PCT;
  blockWeightPct: number;
  status: RequirementStatus;
  evidenceState: EvidenceState;
  sources: EvidenceSource[];
  /** Model-written reading of the evidence. Always labelled as interpretation. */
  interpretation: string | null;
  /** Stored confidence (0..1) when the record has one. Never derived here. */
  confidence: number | null;
  matchedTerms: string[];
  validationNeed: string | null;
  reviewer: { status: string; note: string | null; at: string | null } | null;
  /** Plain-language restatement of the rule the engine applied. */
  rule: string;
  credit: number; // 0..1
  /** Points this requirement can contribute to the 0-100 score. */
  pointsAvailable: number;
  pointsEarned: number;
  decisionImpact: string;
};

/** Sanity note the UI shows when the chain is incomplete. */
export type EvidenceChainMeta = {
  total: number;
  verified: number;
  missing: number;
  conflicting: number;
  userConfirmed: number;
  interpretationOnly: number;
  hasStoredConfidence: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const asText = (v: unknown): string =>
  typeof v === "string" ? v : v == null ? "" : String(v);

const normStatus = (v: unknown): RequirementStatus => {
  const s = asText(v).toLowerCase();
  if (s === "met" || s === "strong") return "met";
  if (s === "partial") return "partial";
  if (s === "contradicted" || s === "contradictory" || s === "conflicting")
    return "contradicted";
  if (s === "missing" || s === "weak" || s === "not_met") return "missing";
  return "unknown";
};

const keyOf = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);

function ruleFor(status: RequirementStatus, required: boolean): string {
  const block = required ? "must-have block (60% of the score)" : "preferred block (20% of the score)";
  const credit = STATUS_CREDIT[status];
  if (status === "unknown")
    return `No usable evidence yet, so the engine credits 0.4 of this requirement in the ${block} instead of scoring it zero, and flags it for validation.`;
  if (status === "contradicted")
    return `Conflicting evidence scores 0 credit in the ${block} and sets the contradiction status on the run.`;
  return `Status "${status}" credits ${credit} of this requirement inside the ${block}.`;
}

function impactFor(
  status: RequirementStatus,
  required: boolean,
  state: EvidenceState,
): string {
  if (status === "contradicted")
    return "Blocks delivery until a reviewer resolves the conflict — the run carries a contradiction status.";
  if (required && (status === "missing" || status === "unknown"))
    return status === "missing"
      ? "Missing must-have evidence holds the candidate back from approval; the gap is shown to the client rather than smoothed over."
      : "Held for human validation — nothing is inferred, so this must-have is checked before the candidate can be approved.";
  if (state === "system_interpretation")
    return "Counted, but the reading has no verbatim quote behind it, so it needs a reviewer before it is used in a client-facing claim.";
  if (status === "met")
    return required
      ? "Supports approval — this must-have is evidenced and shown to the client as a strength."
      : "Adds upside without being decisive; surfaced as a supporting strength.";
  if (status === "partial")
    return "Surfaced as a partial match and turned into an interview question rather than a claim.";
  return "Recorded as a gap on the preferred list; it does not block approval.";
}

function stateFor(args: {
  status: RequirementStatus;
  hasQuote: boolean;
  hasInterpretation: boolean;
  reviewerStatus: string | null;
  conflicting: boolean;
}): EvidenceState {
  if (args.reviewerStatus === "accepted" || args.reviewerStatus === "edited")
    return "user_confirmed";
  if (args.conflicting || args.status === "contradicted") return "conflicting";
  if (args.hasQuote) return "verified";
  if (args.hasInterpretation) return "system_interpretation";
  return "missing";
}

/**
 * Build the chain from records the workspace already loads.
 * All inputs are optional — anything absent is represented honestly as missing.
 */
export function buildEvidenceChain(input: {
  /** score_runs.result.requirement_assessment */
  assessment?: Any[] | null;
  /** candidate_evidence.extracted.insights.requirement_verdicts */
  verdicts?: Any[] | null;
  /** candidate_evidence_items rows */
  items?: Any[] | null;
}): { nodes: EvidenceChainNode[]; meta: EvidenceChainMeta } {
  const assessment = Array.isArray(input.assessment) ? input.assessment : [];
  const verdicts = Array.isArray(input.verdicts) ? input.verdicts : [];
  const items = Array.isArray(input.items) ? input.items : [];

  const verdictByKey = new Map<string, Any>();
  for (const v of verdicts) {
    const t = asText(v?.requirement_text);
    if (t) verdictByKey.set(keyOf(t), v);
  }
  const itemByKey = new Map<string, Any>();
  for (const it of items) {
    const k = keyOf(asText(it?.rubric_criterion_key));
    if (k && !itemByKey.has(k)) itemByKey.set(k, it);
  }

  // Requirement rows come from the engine assessment; verdicts add quotes.
  const rows: Any[] =
    assessment.length > 0
      ? assessment
      : verdicts.map((v) => ({
          id: asText(v?.requirement_text),
          text: asText(v?.requirement_text),
          required: Boolean(v?.required),
          status: normStatus(v?.verdict),
          matched_terms: [],
          evidence: [],
        }));

  const mustCount = rows.filter((r) => r.required).length || 1;
  const prefCount = rows.filter((r) => !r.required).length || 1;

  const nodes: EvidenceChainNode[] = rows.map((r, i) => {
    const requirement = asText(r.text ?? r.requirement_text ?? r.label ?? r.name);
    const k = keyOf(requirement);
    const verdict = verdictByKey.get(k);
    const item = itemByKey.get(k);
    const required = Boolean(r.required ?? verdict?.required);
    const status = normStatus(r.status ?? verdict?.verdict);

    const sources: EvidenceSource[] = [];
    for (const e of (r.evidence ?? []) as Any[]) {
      const quote = asText(e?.snippet).trim();
      if (!quote) continue;
      sources.push({
        kind: asText(e?.source) || "cv",
        location: asText(e?.location) || null,
        quote,
      });
    }
    const cvQuote = asText(verdict?.cv_quote).trim();
    if (cvQuote && !sources.some((s) => s.quote === cvQuote))
      sources.push({ kind: "cv", location: null, quote: cvQuote });
    const itemQuote = asText(item?.source_passage ?? item?.factual_quote).trim();
    if (itemQuote && !sources.some((s) => s.quote === itemQuote))
      sources.push({
        kind: asText(item?.source_kind) || "cv",
        location: item?.source_location ? (typeof item.source_location === 'object' ? (item.source_location.label ?? item.source_location.page ?? JSON.stringify(item.source_location)) : String(item.source_location)) : null,
        quote: itemQuote,
      });

    const interpretation =
      asText(verdict?.rationale).trim() ||
      asText(item?.normalized_meaning ?? item?.interpretation).trim() ||
      null;

    const reviewerStatus = asText(item?.reviewer_status).trim() || null;
    const conflicting =
      asText(item?.result) === "contradictory" ||
      asText(item?.match_type) === "conflicting";

    const evidenceState = stateFor({
      status,
      hasQuote: sources.length > 0,
      hasInterpretation: Boolean(interpretation),
      reviewerStatus,
      conflicting,
    });

    const credit = STATUS_CREDIT[status];
    const blockKey: keyof typeof BLOCK_WEIGHT_PCT = required ? "must_have" : "preferred";
    const blockWeightPct = BLOCK_WEIGHT_PCT[blockKey];
    const pointsAvailable = blockWeightPct / (required ? mustCount : prefCount);
    const rawConf = item?.confidence;
    const confidence =
      typeof rawConf === "number" && Number.isFinite(rawConf) ? rawConf : null;

    return {
      id: asText(r.id) || `req-${i}`,
      requirement,
      required,
      importanceLabel: required ? "Must-have" : "Preferred",
      blockKey,
      blockWeightPct,
      status,
      evidenceState,
      sources,
      interpretation,
      confidence,
      matchedTerms: Array.isArray(r.matched_terms)
        ? r.matched_terms.filter((t: unknown) => typeof t === "string")
        : [],
      validationNeed: asText(item?.validation_need).trim() || null,
      reviewer: reviewerStatus
        ? {
            status: reviewerStatus,
            note: asText(item?.reviewer_note).trim() || null,
            at: asText(item?.reviewed_at) || null,
          }
        : null,
      rule: ruleFor(status, required),
      credit,
      pointsAvailable: Math.round(pointsAvailable * 10) / 10,
      pointsEarned: Math.round(pointsAvailable * credit * 10) / 10,
      decisionImpact: impactFor(status, required, evidenceState),
    };
  });

  const meta: EvidenceChainMeta = {
    total: nodes.length,
    verified: nodes.filter((n) => n.evidenceState === "verified").length,
    missing: nodes.filter((n) => n.evidenceState === "missing").length,
    conflicting: nodes.filter((n) => n.evidenceState === "conflicting").length,
    userConfirmed: nodes.filter((n) => n.evidenceState === "user_confirmed").length,
    interpretationOnly: nodes.filter((n) => n.evidenceState === "system_interpretation")
      .length,
    hasStoredConfidence: nodes.some((n) => n.confidence != null),
  };

  return { nodes, meta };
}

export const EVIDENCE_STATE_LABEL: Record<EvidenceState, string> = {
  verified: "Verified quote",
  missing: "No evidence found",
  conflicting: "Conflicting evidence",
  user_confirmed: "Confirmed by reviewer",
  system_interpretation: "System interpretation only",
};

export const EVIDENCE_STATE_MEANING: Record<EvidenceState, string> = {
  verified: "A verbatim passage from the CV or screening answers backs this requirement.",
  missing: "Nothing in the CV or answers speaks to this requirement. It is shown as a gap, never inferred.",
  conflicting: "The CV and the screening answers disagree, so the run is held for review.",
  user_confirmed: "A reviewer read the source and accepted or corrected the evidence.",
  system_interpretation: "The model wrote a reading of the evidence but attached no quote, so it is not treated as verified.",
};

/**
 * Representative chain used on the public Platform page.
 * Labelled as representative data everywhere it renders — not a real candidate.
 */
export const REPRESENTATIVE_CHAIN = buildEvidenceChain({
  assessment: [
    {
      id: "rep-1",
      text: "5+ years operating Kubernetes in production",
      required: true,
      status: "met",
      matched_terms: ["kubernetes", "production"],
      evidence: [
        {
          source: "cv",
          location: "cv:1180-1264",
          snippet:
            "Ran the production Kubernetes platform (42 services, 3 regions) for six years as staff engineer.",
        },
      ],
    },
    {
      id: "rep-2",
      text: "Owned an on-call rotation for a customer-facing service",
      required: true,
      status: "partial",
      matched_terms: ["on-call"],
      evidence: [
        {
          source: "cv",
          location: "cv:2410-2468",
          snippet: "Shared on-call for internal tooling; escalation owner during incidents.",
        },
      ],
    },
    {
      id: "rep-3",
      text: "Formal SOC 2 audit experience",
      required: true,
      status: "missing",
      matched_terms: [],
      evidence: [],
    },
    {
      id: "rep-4",
      text: "Terraform or equivalent infrastructure as code",
      required: false,
      status: "met",
      matched_terms: ["terraform"],
      evidence: [
        {
          source: "cv",
          location: "cv:3120-3175",
          snippet: "Migrated 200+ hand-built resources to Terraform modules with review gates.",
        },
      ],
    },
    {
      id: "rep-5",
      text: "Available within four weeks",
      required: false,
      status: "contradicted",
      matched_terms: [],
      evidence: [
        {
          source: "screening",
          location: "screening:availability",
          snippet: "Screening answer: 3 months notice. CV states 'immediately available'.",
        },
      ],
    },
  ],
  verdicts: [
    {
      requirement_text: "5+ years operating Kubernetes in production",
      required: true,
      verdict: "met",
      rationale: "Six years of platform ownership at production scale, stated with system counts.",
      cv_quote:
        "Ran the production Kubernetes platform (42 services, 3 regions) for six years as staff engineer.",
    },
    {
      requirement_text: "Owned an on-call rotation for a customer-facing service",
      required: true,
      verdict: "partial",
      rationale: "On-call is evidenced, but for internal tooling rather than a customer-facing service.",
    },
  ],
  items: [
    {
      rubric_criterion_key: "5+ years operating Kubernetes in production",
      reviewer_status: "accepted",
      reviewer_note: "Checked against the CV — dates line up.",
      reviewed_at: "2026-07-29T09:14:00.000Z",
      confidence: 0.92,
    },
    {
      rubric_criterion_key: "Available within four weeks",
      result: "contradictory",
      match_type: "conflicting",
      validation_need: "Confirm the real notice period before scheduling.",
    },
  ],
});
