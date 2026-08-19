import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatEnumLabel } from "@/lib/human-labels";
import { memo } from "react";
import { BadgeCheck, CheckCircle2, Info, ShieldAlert, Sparkles, XCircle, } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { buildShortlistRationale } from "@/lib/client-rationale";
import { buildValidationList } from "@/lib/client/validation-list";
import { SectionCard, Metric } from "./shared";
import { formatDateTime, APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
export function statusBadge(status) {
    switch (status) {
        case "met":
            return {
                label: "Met",
                aria: "Met",
                icon: _jsx(CheckCircle2, { className: "h-3 w-3", "aria-hidden": true }),
                className: "taas-bg-success-soft taas-fg-success ",
            };
        case "partial":
            return {
                label: "Partial",
                aria: "Partially met",
                icon: _jsx(Info, { className: "h-3 w-3", "aria-hidden": true }),
                className: "taas-bg-warning-soft taas-fg-warning ",
            };
        case "contradicted":
            return {
                label: "Conflict",
                aria: "Contradicted",
                icon: _jsx(XCircle, { className: "h-3 w-3", "aria-hidden": true }),
                className: "taas-bg-danger-soft taas-fg-danger ",
            };
        case "not_applicable":
            return {
                label: "N/A",
                aria: "Not applicable",
                icon: _jsx(Info, { className: "h-3 w-3", "aria-hidden": true }),
                className: "taas-bg-neutral-soft taas-fg-neutral ",
            };
        default:
            return {
                label: "Running...",
                aria: "Evidence extraction running",
                icon: _jsx(Info, { className: "h-3 w-3", "aria-hidden": true }),
                className: "taas-bg-neutral-soft taas-fg-neutral ",
            };
    }
}
export function accentToRing(accent) {
    switch (accent) {
        case "emerald":
            return { text: "taas-fg-success ", stroke: "taas-fg-success" };
        case "sky":
            return { text: "taas-fg-info ", stroke: "taas-fg-info" };
        case "amber":
            return { text: "taas-fg-warning ", stroke: "taas-fg-warning" };
        case "rose":
            return { text: "taas-fg-danger ", stroke: "taas-fg-danger" };
        default:
            return { text: "taas-fg-neutral ", stroke: "taas-fg-neutral" };
    }
}
export function accentToSoftBg(accent) {
    switch (accent) {
        case "emerald":
            return "taas-bg-success-soft";
        case "sky":
            return "taas-bg-info-soft";
        case "amber":
            return "taas-bg-warning-soft";
        case "rose":
            return "taas-bg-danger-soft";
        default:
            return "bg-muted/30";
    }
}
export const EvaluationProvenance = memo(function EvaluationProvenance({ candidate, }) {
    const ev = candidate.evaluation;
    const anyValue = ev.category_breakdown.some((c) => c.value != null);
    if (!ev.engine_version && !ev.contradiction && !anyValue)
        return null;
    const pretty = (s) => formatEnumLabel(s);
    return (_jsxs("section", { "aria-labelledby": "evaluation-heading", className: "hidden rounded-xl border bg-card p-5", children: [
            _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                    _jsx(BadgeCheck, { className: "h-4 w-4 text-muted-foreground", "aria-hidden": true }), _jsx("h3", { id: "evaluation-heading", className: "text-sm font-semibold tracking-tight", children: "How this score was built" })
                ] }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Every category is grounded in verbatim CV evidence and screening answers. Nothing is inferred. Each evaluation is versioned and preserved \u2014 a rescore appends a new run, never edits the old one." }), ev.contradiction && (_jsxs("div", { className: "mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm", children: [
                    _jsxs("div", { className: "flex items-center gap-2 font-medium text-destructive", children: [
                            _jsx(ShieldAlert, { className: "h-4 w-4", "aria-hidden": true }),
                            "Conflicting signals found"] }), _jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [pretty(ev.contradiction), " \u2014 flagged in evidence review before this candidate was delivered to your workspace."] })
                ] })), anyValue && (_jsx("div", { className: "mt-4 space-y-2.5", children: ev.category_breakdown.map((c) => {
                    const pct = c.value == null
                        ? null
                        : Math.max(0, Math.min(100, Math.round(c.value * 100)));
                    return (_jsxs("div", { children: [
                            _jsxs("div", { className: "flex items-baseline justify-between text-xs", children: [
                                    _jsxs("span", { className: "font-medium", children: [c.label, c.weight != null && (_jsxs("span", { className: "ml-2 text-muted-foreground", children: ["\u00B7 weighting ", Math.round(c.weight * 100), "%"] }))] }), _jsx("span", { className: "tabular-nums text-muted-foreground", children: pct == null ? "—" : `${pct}%` })
                                ] }), _jsx("div", { className: "mt-1 h-1.5 rounded-full bg-muted", children: _jsx("div", { className: "h-1.5 rounded-full bg-primary transition-all", style: { width: `${pct ?? 0}%` } }) })
                        ] }, c.label));
                }) })), ev.completed_at && (_jsxs("p", { className: "mt-3 text-[11px] text-muted-foreground", children: ["Evaluation completed", " ", formatDateTime(ev.completed_at)] }))] }));
});
export const FitHero = memo(function FitHero({ candidate, }) {
    const fit = candidate.fit;
    const ring = accentToRing(fit.accent);
    const bg = accentToSoftBg(fit.accent);
    const dashArray = 251.2; // 2π·40
    // The ring encodes the fit band, not the internal number — a percentage arc
    // would leak engine precision onto an employer surface.
    const BAND_FILL = {
        exceptional: 1, strong: 0.8, good: 0.6, mixed: 0.4, limited: 0.2, not_recommended: 0.08,
    };
    const dashOffset = dashArray * (1 - (BAND_FILL[fit.band] ?? 0.4));
    return (_jsx("section", { "aria-labelledby": "fit-heading", className: cn("rounded-xl border p-5 sm:p-6", bg), children: _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-6", children: [
                _jsxs("div", { className: "min-w-0 flex-1", children: [
                        _jsxs("div", { className: "flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground", children: [
                                _jsx(Sparkles, { className: "h-3.5 w-3.5", "aria-hidden": true }),
                                "Fit for ", candidate.position?.title ?? "this role"] }), _jsx("h2", { id: "fit-heading", className: "mt-1 text-2xl font-semibold tracking-tight", children: fit.headline }), _jsx("p", { className: cn("mt-0.5 text-sm font-medium", ring.text), children: fit.recommendation }), _jsx("p", { className: "mt-1 text-[11px] text-muted-foreground", children: "Role-specific fit. This candidate carries no global rating." }), candidate.summary && (_jsx("p", { className: "mt-3 text-sm leading-relaxed text-foreground/90", children: candidate.summary })), candidate.last_updated && (_jsxs("p", { className: "mt-2 text-xs text-muted-foreground", children: ["Scored ", new Date(candidate.last_updated).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE })] }))] }), false && candidate.fit_label != null && (_jsx("div", { className: "flex items-center gap-4", children: _jsxs("div", { role: "img", "aria-label": `Fit for this role: ${fit.headline} — ${fit.recommendation}`, className: "relative", children: [
                            _jsxs("svg", { width: "96", height: "96", viewBox: "0 0 96 96", "aria-hidden": true, children: [
                                    _jsx("circle", { cx: "48", cy: "48", r: "40", fill: "none", stroke: "currentColor", strokeOpacity: "0.15", strokeWidth: "8" }), _jsx("circle", { cx: "48", cy: "48", r: "40", fill: "none", className: ring.stroke, strokeWidth: "8", strokeLinecap: "round", strokeDasharray: dashArray, strokeDashoffset: dashOffset, transform: "rotate(-90 48 48)" })
                                ] }), _jsxs("div", { className: "pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center", children: [
                                    _jsx("span", { className: "text-xs font-semibold leading-tight", children: fit.headline }), _jsx("span", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: "fit" })
                                ] })
                        ] }) }))] }) }));
});
export const WhyWeShortlisted = memo(function WhyWeShortlisted({ candidate, }) {
    const rationale = buildShortlistRationale(candidate);
    if (rationale.lines.length === 0)
        return null;
    const tone = {
        met: "border-success/30 bg-success/5",
        partial: "border-warning/30 bg-warning/5",
        gap: "border-border bg-muted/30",
        not_applicable: "border-border bg-muted/20",
    };
    return (_jsxs(SectionCard, { title: "Why we shortlisted", icon: _jsx(CheckCircle2, { className: "h-4 w-4" }), description: "One line for every requirement you gave us at intake, with the source of each claim.", children: [
            _jsx("p", { className: "text-xs text-muted-foreground", children: rationale.summary }), _jsx("ul", { className: "mt-3 space-y-2", children: rationale.lines.map((l) => (_jsxs("li", { className: `rounded-md border p-3 ${tone[l.verdict]}`, children: [
                        _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                                _jsx("span", { className: "font-medium text-sm", children: l.requirement }), _jsx(Badge, { variant: "outline", className: "text-[10px] uppercase tracking-wide", children: l.importance === "must_have" ? "Must-have" : "Preferred" }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: l.verdictLabel })
                            ] }), l.claim ? (_jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: l.claim })) : l.underReview ? (_jsx("p", { className: "mt-1 text-sm text-muted-foreground italic", children: "Evidence under review" })) : (_jsx("p", { className: "mt-1 text-sm text-muted-foreground italic", children: "No evidence captured for this yet \u2014 we will not claim it." })), l.sources.length > 0 && (_jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: l.sources.map((src) => (_jsxs("span", { className: "rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground", children: ["Source: ", src] }, src))) }))] }, l.id))) })
        ] }));
});
export const RequirementRowView = memo(function RequirementRowView({ row, }) {
    const badge = statusBadge(row.status);
    return (_jsxs("li", { className: "rounded-md border bg-background/40 p-3", children: [
            _jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [
                    _jsxs("div", { className: "min-w-0 flex-1", children: [
                            _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                                    _jsx("span", { className: "font-medium", children: row.label }), _jsx(Badge, { variant: "outline", className: "text-[10px] uppercase tracking-wide", children: row.importance === "must_have" ? "Must-have" : "Preferred" })
                                ] }), row.explanation && (_jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: row.explanation }))] }), _jsxs("span", { className: cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", badge.className), "aria-label": badge.aria, children: [badge.icon, badge.label] })
                ] }), (row.evidence.length > 0 || row.context.length > 0) && (_jsx(Accordion, { type: "single", collapsible: true, className: "mt-2", children: _jsxs(AccordionItem, { value: "evidence", className: "border-none", children: [
                        _jsx(AccordionTrigger, { className: "py-1 text-xs text-muted-foreground hover:no-underline", children: row.evidence.length > 0
                                ? `Show evidence (${row.evidence.length})`
                                : "Show context" }), _jsxs(AccordionContent, { children: [row.evidence.length > 0 && (_jsx("ul", { className: "mt-1 space-y-2 border-l-2 border-primary/30 pl-3 text-sm", children: row.evidence.map((e, i) => (_jsxs("li", { children: [e.source && (_jsx("div", { className: "text-[11px] uppercase tracking-wide text-muted-foreground", children: e.source })), _jsx("div", { className: "text-foreground/90", children: e.snippet })
                                        ] }, i))) })), row.evidence.length === 0 && (_jsx("p", { className: "text-sm text-muted-foreground italic", children: "Evidence extraction is still running for this role." })), row.context.length > 0 && (_jsxs("div", { className: "mt-3", children: [
                                        _jsx("div", { className: "text-[11px] uppercase tracking-wide text-muted-foreground", children: "Candidate context" }), _jsx("ul", { className: "mt-1 space-y-2 border-l-2 border-muted pl-3 text-sm", children: row.context.map((e, i) => (_jsxs("li", { children: [e.source && (_jsx("div", { className: "text-[11px] uppercase tracking-wide text-muted-foreground", children: e.source })), _jsx("div", { className: "text-muted-foreground", children: e.snippet })
                                                ] }, i))) })
                                    ] }))] })
                    ] }) })), row.evidence.length === 0 && row.context.length === 0 && row.status === "not_evidenced" && (_jsx("p", { className: "mt-2 text-sm text-muted-foreground italic", children: "Evidence extraction is still running for this role." }))] }));
});
export const RequirementCoverage = memo(function RequirementCoverage({ candidate, withRationale = false, }) {
    const { coverage, requirement_rows } = candidate;
    if (requirement_rows.length === 0)
        return null;
    const rationale = withRationale ? buildShortlistRationale(candidate) : null;
    return (_jsxs(SectionCard, { title: "Requirement coverage", icon: _jsx(CheckCircle2, { className: "h-4 w-4" }), description: "Every declared role requirement, mapped to the evidence we found.", children: [rationale && rationale.lines.length > 0 && (_jsx("p", { className: "mb-3 text-xs text-muted-foreground", children: rationale.summary })), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [
                    _jsx(Metric, { label: "Must-have met", value: "Running...", tone: "slate" }), _jsx(Metric, { label: "Partially met", value: "Running...", tone: "slate" }), _jsx(Metric, { label: "Not evidenced", value: "Running...", tone: "slate" }), _jsx(Metric, { label: "Preferred met", value: "Running...", tone: "slate" })
                ] }), _jsxs("div", { className: "mt-4", children: [
                    _jsxs("div", { className: "flex items-center justify-between text-xs text-muted-foreground", children: [
                            _jsx("span", { children: "Overall coverage" }), _jsx("span", { className: "tabular-nums", children: "Running..." })
                        ] }), _jsx(Progress, { value: 0, className: "mt-1" })
                ] }), _jsx(Separator, { className: "my-4" }), _jsx("ul", { className: "space-y-2", children: requirement_rows.map((r) => (_jsx(RequirementRowView, { row: r }, r.id))) })
        ] }));
});
export const WhyThisCandidate = memo(function WhyThisCandidate({ candidate, }) {
    if (candidate.strengths.length === 0)
        return null;
    return (_jsx(SectionCard, { title: "Why this candidate", icon: _jsx(Sparkles, { className: "h-4 w-4" }), description: "The strongest verified reasons to consider this candidate for the role.", children: _jsx("ul", { className: "grid gap-3 sm:grid-cols-2", children: candidate.strengths.map((s, i) => (_jsx("li", { className: "rounded-md border taas-bd-success taas-bg-success-soft p-3", children: _jsxs("div", { className: "flex items-start gap-2", children: [
                        _jsx(CheckCircle2, { className: "mt-0.5 h-4 w-4 shrink-0 taas-fg-success", "aria-hidden": true }), _jsx("span", { className: "text-sm", children: s })
                    ] }) }, i))) }) }));
});
export const WhatNeedsValidation = memo(function WhatNeedsValidation({ candidate, }) {
    // Derived from the same coverage statuses rendered by RequirementCoverage, so
    // a badge and its validation sentence can never disagree.
    const items = buildValidationList(candidate.requirement_rows, candidate.concerns);
    if (items.length === 0)
        return null;
    return (_jsx(SectionCard, { title: "What needs validation", icon: _jsx(Info, { className: "h-4 w-4" }), description: "Areas to confirm during the interview before a hiring decision.", children: _jsx("ul", { className: "space-y-2", children: items.map((item) => (_jsxs("li", { className: cn("flex items-start gap-2 rounded-md border p-3 text-sm", item.tone === "warning"
                    ? "taas-bd-warning taas-bg-warning-soft"
                    : "bg-muted/30"), children: [
                    _jsx(Info, { className: cn("mt-0.5 h-4 w-4 shrink-0", item.tone === "warning" ? "taas-fg-warning" : "text-muted-foreground"), "aria-hidden": true }), _jsx("span", { children: item.label ? (_jsxs(_Fragment, { children: [
                                _jsx("strong", { className: "font-medium", children: item.label }),
                                " \u2014 ", item.sentence] })) : (item.sentence) })
                ] }, item.id))) }) }));
});
