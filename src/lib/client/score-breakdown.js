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
import { plural, pluralWord } from "@/lib/format/plural";
function countRows(rows) {
    const met = rows.filter((r) => r.status === "met").length;
    const partial = rows.filter((r) => r.status === "partial").length;
    const missing = rows.filter((r) => r.status === "not_evidenced" || r.status === "contradicted").length;
    return { met, partial, missing };
}
function mustTakeaway(c) {
    if (c.total === 0)
        return "No must-haves were declared for this role.";
    if (c.missing > 0) {
        return `${plural(c.met, "must-have")} of ${c.total} are quoted from evidence; ${c.partial > 0 ? `${c.partial} are partial, ` : ""}${c.missing} ${pluralWord(c.missing, "carries", "carry")} none yet.`;
    }
    if (c.partial > 0) {
        return `${c.met} of ${c.total} must-haves are quoted directly, ${c.partial} only related.`;
    }
    return `All ${c.total} must-haves are quoted directly from the CV or screening answers.`;
}
function preferredTakeaway(c) {
    if (c.total === 0)
        return "No preferred requirements were declared for this role.";
    const evidenced = c.met + c.partial;
    if (evidenced === 0)
        return `None of the ${c.total} preferred requirements are evidenced yet.`;
    return `${evidenced} of ${c.total} preferred requirements add to the ranking.`;
}
export function buildScoreBreakdown(candidate) {
    const rows = candidate.requirement_rows ?? [];
    const must = rows.filter((r) => r.importance === "must_have");
    const preferred = rows.filter((r) => r.importance !== "must_have");
    const mustCounts = { ...countRows(must), total: must.length };
    const prefCounts = { ...countRows(preferred), total: preferred.length };
    const groups = [
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
    const rubric = []; // Suppressed factor block — fix P-035.
    const reasons = [];
    // Strongest evidenced must-haves lead, because they decide the ranking.
    // We use the requirement ID to ensure mutual exclusivity.
    const reasonsByRequirement = new Map();
    must
        .filter((r) => r.status === "met")
        .slice(0, 3)
        .forEach((r, i) => {
        const id = r.id || `must-met-${i}`;
        reasonsByRequirement.set(id, {
            id,
            tone: "positive",
            text: `Meets the must-have "${r.label}", quoted from ${r.evidence?.[0]?.source ?? "the application"}.`,
        });
    });
    (candidate.strengths ?? []).slice(0, 3).forEach((s, i) => reasons.push({ id: `strength-${i}`, tone: "positive", text: s }));
    must
        .filter((r) => r.status === "not_evidenced" || r.status === "contradicted")
        .slice(0, 3)
        .forEach((r, i) => {
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
        .filter((r) => r.status === "partial")
        .slice(0, 2)
        .forEach((r, i) => {
        const id = r.id || `must-partial-${i}`;
        if (!reasonsByRequirement.has(id)) {
            reasonsByRequirement.set(id, {
                id,
                tone: "watch",
                text: `Only partial evidence for required: ${r.label}`,
            });
        }
    });
    // Convert the map to the reasons list
    for (const reason of reasonsByRequirement.values()) {
        reasons.push(reason);
    }
    (candidate.concerns ?? []).slice(0, 3).forEach((c, i) => reasons.push({ id: `concern-${i}`, tone: "watch", text: c }));
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
    const criteriaSummary = explanation && explanation.kind === "explained"
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
