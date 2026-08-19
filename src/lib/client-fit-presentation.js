// Client-safe candidate presentation contract.
// Pure functions. No DB access. Consumed by client-kpi.server.ts and the page.
//
// Two concerns live here:
//   1) Fit-band normalisation — internal labels → Client-facing language + tone.
//   2) Interview-guide generator — deterministic, evidence-grounded, personalised.
//
// Thresholds are not defined in this file. Any score → band decision defers to
// src/lib/scoring/bands.ts.
import { cleanQuote, isTemplatedEvidence, isGenericSkillsList, isRelevantEvidence, isCandidateHeadline, } from "@/lib/evidence/quote-hygiene";
import { classifyBand } from "@/lib/scoring/bands";
/**
 * The ONE place raw band vocabulary is normalised. Covers all three historic
 * systems: the engine's fit_label, the DB `score_band` enum, and legacy
 * presentation words. Anything unmapped falls back to score thresholds, then
 * to "mixed" — never to an internal label.
 */
const RAW_LABEL_MAP = {
    // engine (scoring-engine.server.ts)
    strong_fit: "strong",
    worth_considering: "mixed",
    not_a_fit: "not_recommended",
    unknown: "mixed",
    // DB score_band enum
    exceptional: "exceptional",
    top: "exceptional",
    strong: "strong",
    consider: "mixed",
    not_recommended: "not_recommended",
    unscored: "mixed",
    // legacy presentation words
    excellent: "exceptional",
    high: "strong",
    good: "good",
    potential: "good",
    medium: "mixed",
    mixed: "mixed",
    average: "mixed",
    low: "limited",
    limited: "limited",
    weak: "limited",
    none: "not_recommended",
};
/**
 * Canonical band key → client-facing fit band. Keeps the existing client
 * vocabulary while the numbers behind it live in one place.
 */
const CANONICAL_TO_FIT_BAND = {
    exceptional: "exceptional",
    top: "strong",
    strong: "good",
    consider: "mixed",
    not_recommended: "not_recommended",
    unscored: "mixed",
};
const BAND_TABLE = {
    exceptional: {
        headline: "Exceptional Match",
        recommendation: "Prioritise for interview",
        tone: "confident",
        accent: "emerald",
    },
    strong: {
        headline: "Strong Match",
        recommendation: "Recommend interview",
        tone: "confident",
        accent: "emerald",
    },
    good: {
        headline: "Good Potential",
        recommendation: "Worth a conversation",
        tone: "positive",
        accent: "sky",
    },
    mixed: {
        headline: "Mixed Fit",
        recommendation: "Review before deciding",
        tone: "neutral",
        accent: "amber",
    },
    limited: {
        headline: "Limited Fit",
        recommendation: "Interview only if a gap can be closed",
        tone: "cautious",
        accent: "amber",
    },
    not_recommended: {
        headline: "Not Recommended",
        recommendation: "Requirements not evidenced",
        tone: "dissuade",
        accent: "slate",
    },
};
/**
 * Normalise a raw fit label + numeric score into the Client-facing fit band.
 * Never surfaces internal labels ("not_a_fit", "manual_review_required", …).
 *
 * The SCORE decides the band. Stored `fit_label` / `fit_band` strings are only
 * a fallback for runs that never recorded a number: historical runs were
 * written with older cut-offs (a 73 stored as `worth_considering`, a 50 stored
 * as `not_a_fit`), so trusting the string first made the headline contradict
 * the number shown next to it on the same card.
 */
export function toFitPresentation(rawLabel, score) {
    let band = null;
    if (typeof score === "number" && Number.isFinite(score)) {
        // Derives from the ONE band table, never local cut-offs or stored strings.
        band = CANONICAL_TO_FIT_BAND[classifyBand(score)] ?? null;
    }
    if (!band && rawLabel) {
        const key = rawLabel.toLowerCase().replace(/[^a-z_]/g, "");
        band = RAW_LABEL_MAP[key] ?? null;
    }
    band ??= "mixed";
    return { band, ...BAND_TABLE[band] };
}
function normStatus(raw) {
    const s = String(raw ?? "").toLowerCase();
    if (["met", "matched", "covered", "yes", "true", "strong", "supported"].includes(s))
        return "met";
    if (["partial", "partially", "partially_met", "weak"].includes(s))
        return "partial";
    if (["contradicted", "conflict", "conflicts", "contradiction"].includes(s))
        return "contradicted";
    if (["not_applicable", "na", "n/a"].includes(s))
        return "not_applicable";
    return "not_evidenced";
}
/**
 * Stable, human-independent identity for a requirement written as free text.
 * The same requirement text always yields the same row id, so selections and
 * comparisons survive re-ordering of the position's requirement array.
 */
export function requirementSlug(text) {
    return (String(text)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "requirement");
}
const STATUS_RANK = {
    met: 4,
    partial: 3,
    contradicted: 2,
    not_evidenced: 1,
    not_applicable: 0,
};
/**
 * Merge the position's declared requirements with the score-run coverage map.
 * Guarantees a row for every declared requirement so the Client sees the full
 * matrix (met + partial + missing) even when the LLM omits negatives.
 *
 * Evidence integrity: only per-candidate, per-requirement quotes pass through.
 * Generic template snippets ("Core stack: ...", "full regression suite", etc.)
 * are moved to `context` so they never render as evidence. If a verdict had no
 * direct evidence after filtering, its status is downgraded to not_evidenced.
 */
export function buildRequirementRows(position, coverage, evidenceItems) {
    const rows = [];
    const cov = (coverage ?? {});
    // Helpers that split real evidence from generic context.
    const splitEvidence = (raw, requirementLabel) => {
        const evidence = [];
        const context = [];
        for (const e of raw) {
            if (!e.snippet)
                continue;
            const snippet = e.snippet;
            if (isTemplatedEvidence(snippet) || isCandidateHeadline(snippet)) {
                context.push(e);
            }
            else if (isRelevantEvidence(snippet, requirementLabel)) {
                evidence.push(e);
            }
            else {
                context.push(e);
            }
        }
        return { evidence, context };
    };
    // Index whatever the run gave us by label (case-insensitive).
    const covIndex = new Map();
    const stash = (arr, defaultStatus) => {
        if (!Array.isArray(arr))
            return;
        for (const item of arr) {
            const label = typeof item === "string"
                ? item
                : item?.label ?? item?.requirement ?? item?.name ?? null;
            if (!label)
                continue;
            const key = String(label).toLowerCase().trim();
            const status = normStatus(typeof item === "string" ? defaultStatus : item?.status ?? defaultStatus);
            const rawEvidence = typeof item === "string"
                ? []
                : Array.isArray(item?.evidence)
                    ? item.evidence
                        .slice(0, 3)
                        .map((e) => ({
                        source: e?.source ?? e?.section ?? null,
                        snippet: cleanQuote(String(e?.snippet ?? e?.text ?? e?.value ?? "")),
                    }))
                        .filter((e) => e.snippet)
                    : [];
            const split = splitEvidence(rawEvidence, String(label));
            covIndex.set(key, {
                label: String(label),
                status,
                explanation: typeof item === "string"
                    ? null
                    : item?.explanation ?? item?.rationale ?? item?.note ?? null,
                evidence: split.evidence,
                context: split.context,
            });
        }
    };
    stash(cov.requirements, "met");
    stash(cov.rows, "met");
    stash(cov.matched, "met");
    stash(cov.partial, "partial");
    stash(cov.missing, "not_evidenced");
    stash(cov.contradicted, "contradicted");
    // Verified evidence is keyed on the requirement text it was extracted for
    // (`rubric_criterion_key`). It fills the verdict for string-form requirements,
    // which never appear in the run's coverage map.
    const evIndex = new Map();
    for (const item of evidenceItems ?? []) {
        const key = String(item?.rubric_criterion_key ?? "").toLowerCase().trim();
        if (!key)
            continue;
        const rawSnippet = String(item?.factual_quote ?? item?.interpretation ?? "");
        const cleaned = cleanQuote(rawSnippet);
        const status = normStatus(item?.result ?? item?.match_type);
        const entry = evIndex.get(key) ?? { status, evidence: [], context: [] };
        if (STATUS_RANK[status] > STATUS_RANK[entry.status])
            entry.status = status;
        if (cleaned) {
            if (isTemplatedEvidence(cleaned) || isCandidateHeadline(cleaned)) {
                if ((isGenericSkillsList(cleaned) || isCandidateHeadline(cleaned)) && entry.context.length < 3) {
                    entry.context.push({ source: item?.source_kind ?? null, snippet: cleaned });
                }
            }
            else if (isRelevantEvidence(cleaned, key) && entry.evidence.length < 3) {
                entry.evidence.push({ source: item?.source_kind ?? null, snippet: cleaned });
            }
            else if (entry.context.length < 3) {
                entry.context.push({ source: item?.source_kind ?? null, snippet: cleaned });
            }
        }
        evIndex.set(key, entry);
    }
    const push = (declared, importance) => {
        if (!Array.isArray(declared))
            return;
        declared.forEach((raw) => {
            const label = typeof raw === "string" ? raw : raw?.label ?? raw?.text ?? raw?.name ?? null;
            if (!label)
                return;
            const key = String(label).toLowerCase().trim();
            // 1) Try the verified evidence items first — they are the source of truth for direct quotes.
            const fromEvidence = evIndex.get(key);
            // 2) Fall back to the run's coverage map (engine-generated).
            const found = covIndex.get(key);
            const declaredImportance = typeof raw === "object" && raw !== null && typeof raw.importance === "string"
                ? raw.importance === "preferred"
                    ? "preferred"
                    : "must_have"
                : importance;
            const rawStatus = found?.status ?? fromEvidence?.status ?? "not_evidenced";
            // Prioritise verified evidence snippets over engine-generated ones.
            const rawEvidence = fromEvidence?.evidence && fromEvidence.evidence.length > 0
                ? fromEvidence.evidence
                : (found?.evidence ?? []);
            const rawContext = fromEvidence?.context && fromEvidence.context.length > 0
                ? fromEvidence.context
                : (found?.context ?? []);
            // A verdict that lacks a direct, per-candidate quote is not evidenced.
            // HONESTY GATE: If we have zero evidence, we must not claim it is missing
            // until the extraction bug is resolved.
            const status = rawEvidence.length > 0 ? rawStatus : "not_evidenced";
            rows.push({
                id: `${declaredImportance === "preferred" ? "pref" : "must"}-${requirementSlug(String(label))}`,
                label: String(label),
                importance: declaredImportance,
                status,
                explanation: found?.explanation ?? null,
                evidence: rawEvidence,
                context: rawContext,
            });
            covIndex.delete(key);
        });
    };
    push(position?.requirements, "must_have");
    push(position?.preferred_requirements, "preferred");
    // If the position declared nothing, fall back to whatever the run named,
    // so the Client still sees a coverage matrix.
    if (rows.length === 0) {
        for (const [, v] of covIndex) {
            rows.push({
                id: `run-${requirementSlug(String(v.label))}`,
                label: v.label,
                importance: "must_have",
                status: v.evidence.length > 0 ? v.status : "not_evidenced",
                explanation: v.explanation,
                evidence: v.evidence,
                context: v.context,
            });
        }
    }
    return rows;
}
export function summariseCoverage(rows) {
    const must = rows.filter((r) => r.importance === "must_have");
    const pref = rows.filter((r) => r.importance === "preferred");
    const met = (r) => r.status === "met";
    const partial = (r) => r.status === "partial";
    const missing = (r) => r.status === "not_evidenced" || r.status === "contradicted";
    const must_met = must.filter(met).length;
    const must_partial = must.filter(partial).length;
    const must_missing = must.filter(missing).length;
    const preferred_met = pref.filter(met).length;
    const total = rows.length || 1;
    const weighted = rows.reduce((acc, r) => acc +
        (r.status === "met" ? 1 : r.status === "partial" ? 0.5 : 0) *
            (r.importance === "must_have" ? 1 : 0.5), 0) /
        (rows.reduce((acc, r) => acc + (r.importance === "must_have" ? 1 : 0.5), 0) || 1);
    return {
        must_total: must.length,
        must_met,
        must_partial,
        must_missing,
        preferred_total: pref.length,
        preferred_met,
        overall_pct: Math.round((Number.isFinite(weighted) ? weighted : 0) * 100),
    };
}
/**
 * How many requirements the assessment could actually evidence, out of how many
 * were assessed. This is what employer surfaces show *instead of* a number: a
 * band plus the amount of support behind it. `not_applicable` rows are excluded
 * because they were never in scope.
 */
export function evidenceSupport(rows) {
    const scoped = rows.filter((r) => r.status !== "not_applicable");
    return {
        supported: scoped.filter((r) => r.status === "met" || r.status === "partial").length,
        total: scoped.length,
    };
}
/**
 * Deterministic personalised interview guide. Never generic — every question
 * cites either a specific requirement, strength, or concern from THIS
 * candidate's evidence graph. When we cannot ground a question, we skip it.
 */
export function buildInterviewGuide(input) {
    const out = [];
    const positionRef = input.positionTitle ? ` for the ${input.positionTitle} role` : "";
    // 1) Requirement gaps first — the ones the Client most needs to close.
    const gaps = input.rows.filter((r) => r.status === "partial" || r.status === "not_evidenced" || r.status === "contradicted");
    for (const r of gaps.slice(0, 3)) {
        out.push({
            id: `gap-${r.id}`,
            group: "Requirement Gaps",
            question: `Can you walk us through your most recent hands-on experience with ${r.label.toLowerCase()}?`,
            why: r.status === "partial"
                ? `The CV shows related work, but does not clearly evidence "${r.label}"${positionRef}.`
                : r.status === "contradicted"
                    ? `The available evidence conflicts on "${r.label}"${positionRef}.`
                    : `"${r.label}" is a stated requirement${positionRef} but no supporting evidence was found in the CV or screening answers.`,
            target: r.label,
            indicators: [
                "Cites a concrete, recent example (last 24 months)",
                "Explains personal responsibility, not team scope",
                "Names specific tools, methods, or outcomes",
            ],
            followUp: "Ask for the timeframe and measurable impact.",
        });
    }
    // 2) Strengths — validate the highlights are real.
    for (const s of input.strengths.slice(0, 2)) {
        out.push({
            id: `str-${out.length}`,
            group: "Impact & Achievements",
            question: `Tell us about the initiative you're most proud of that involved ${s.toLowerCase()}. What did you personally deliver and how was impact measured?`,
            why: `"${s}" is one of the strongest supported areas in the profile.`,
            target: s,
            indicators: [
                "Names a specific project and timeframe",
                "Separates personal contribution from team result",
                "Quantifies outcome (users, revenue, cycle-time, quality)",
            ],
        });
    }
    // 3) Availability / logistics only when the data invites the question.
    if (input.availability && /notice|weeks?|months?/i.test(input.availability)) {
        out.push({
            id: "avail",
            group: "Motivation & Availability",
            question: `You've indicated ${input.availability.toLowerCase()}. What's driving your timing and are there commitments we should plan around?`,
            why: "Confirm the stated availability window and surface hidden constraints.",
            target: "Availability",
            indicators: [
                "Explains why they're open now",
                "Confirms the notice window is firm",
                "Flags PTO, relocation, or overlap constraints",
            ],
        });
    }
    if (input.workAuth) {
        out.push({
            id: "auth",
            group: "Motivation & Availability",
            question: `Please confirm your current work authorization and whether it covers the location and hours for this role.`,
            why: "Confirm the authorization the profile lists still applies to this role.",
            target: "Work authorization",
            indicators: ["Confirms current status", "Confirms expiry / renewal", "Confirms location match"],
        });
    }
    // 4) One concern (dedupe with gaps by target).
    for (const c of input.concerns.slice(0, 1)) {
        const already = out.some((q) => q.target.toLowerCase() === c.toLowerCase());
        if (already)
            continue;
        out.push({
            id: `con-${out.length}`,
            group: "Experience Validation",
            question: `We noted "${c}" as an area to validate. Can you walk us through how you've handled this in a recent role?`,
            why: `Named concern in the evidence review${positionRef}.`,
            target: c,
            indicators: ["Directly addresses the concern", "Provides a concrete example", "Reflects on what they learned"],
        });
    }
    return out.slice(0, 8);
}
// Prettify a screaming-uppercase pipe-separated headline into readable text.
export function prettifyHeadline(raw) {
    if (!raw)
        return { headline: null, chips: [] };
    const parts = raw
        .split(/\s*[|·•]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length === 0)
        return { headline: null, chips: [] };
    const titleCase = (s) => s
        .toLowerCase()
        .split(/\s+/)
        .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
        .join(" ")
        .replace(/\b(and|or|of|the|for|in|on)\b/gi, (m) => m.toLowerCase());
    const [primary, ...rest] = parts;
    return {
        headline: titleCase(primary),
        chips: rest.slice(0, 4).map(titleCase),
    };
}
