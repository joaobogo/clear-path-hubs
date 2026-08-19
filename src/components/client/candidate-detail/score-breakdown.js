import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from "react";
import { CheckCircle2, Gauge, Info, ListChecks, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildScoreBreakdown } from "@/lib/client/score-breakdown";
import { SectionCard } from "./shared";
import { RequirementRowView } from "./evidence";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
function CountChip({ label, value, tone, }) {
    const cls = {
        success: "taas-bg-success-soft taas-fg-success",
        warning: "taas-bg-warning-soft taas-fg-warning",
        neutral: "taas-bg-neutral-soft taas-fg-neutral",
    }[tone];
    return (_jsxs("span", { className: cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", cls), children: [
            _jsx("span", { className: "tabular-nums", children: value }), label] }));
}
export const ScoreBreakdown = memo(function ScoreBreakdown({ candidate, }) {
    const b = buildScoreBreakdown(candidate);
    if (b.empty)
        return null;
    const positives = b.reasons.filter((r) => r.tone === "positive");
    const watch = b.reasons.filter((r) => r.tone === "watch");
    return (_jsxs(SectionCard, { title: "Score breakdown", icon: _jsx(Gauge, { className: "h-4 w-4" }), description: "Why this candidate ranks where they do: the evidence behind each requirement, how each scoring criterion landed, and the reasons that moved the score.", children: [candidate.evaluation.contradiction && (_jsxs("div", { className: "mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm", children: [
                    _jsxs("div", { className: "flex items-center gap-2 font-medium text-destructive", children: [
                            _jsx(ShieldAlert, { className: "h-4 w-4", "aria-hidden": true }),
                            "Conflicting signals found"] }), _jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [candidate.evaluation.contradiction, " \u2014 flagged in evidence review before this candidate was delivered to your workspace."] })
                ] })), _jsxs("div", { className: "flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-muted/30 p-3", children: [
                    _jsxs("div", { className: "flex items-end gap-3", children: [
                            _jsx("span", { className: "text-3xl font-semibold tabular-nums leading-none", children: b.score ?? "—" }), _jsxs("div", { className: "text-xs text-muted-foreground", children: [
                                    _jsx("div", { className: "text-sm font-medium text-foreground", children: b.bandLabel }), b.bandFloor != null && b.bandCeiling != null && (_jsxs("div", { className: "tabular-nums", children: ["band range ", b.bandFloor, "\u2013", b.bandCeiling] }))] })
                        ] }), _jsxs("div", { className: "max-w-md text-right text-xs text-muted-foreground", children: [b.methodLabel && (_jsx(Badge, { variant: "secondary", className: "text-[10px]", children: b.methodLabel })), b.criteriaSummary && _jsx("p", { className: "mt-1", children: b.criteriaSummary }), b.scoredAt && (_jsxs("p", { className: "mt-0.5", children: ["Scored ", new Date(b.scoredAt).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE })] }))] })
                ] }), _jsx("div", { className: "mt-4 space-y-4", children: b.groups.map((g) => (_jsxs("div", { children: [
                        _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                                _jsxs("h3", { className: "flex items-center gap-1.5 text-sm font-semibold", children: [
                                        _jsx(ListChecks, { className: "h-3.5 w-3.5 text-muted-foreground", "aria-hidden": true }), g.title] }), _jsxs("span", { className: "text-xs tabular-nums text-muted-foreground", children: [g.met + g.partial, " of ", g.total, " evidenced"] }), g.total > 0 && (_jsxs("span", { className: "flex flex-wrap gap-1.5", children: [
                                        _jsx(CountChip, { label: "quoted", value: g.met, tone: "success" }), g.partial > 0 && (_jsx(CountChip, { label: "related", value: g.partial, tone: "warning" })), g.missing > 0 && (_jsx(CountChip, { label: "no evidence", value: g.missing, tone: "neutral" }))] }))] }), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: g.takeaway }), g.rows.length > 0 && (_jsx("ul", { className: "mt-2 space-y-2", children: g.rows.map((row) => (_jsx(RequirementRowView, { row: row }, row.id))) }))] }, g.kind))) }), (positives.length > 0 || watch.length > 0) && (_jsxs("div", { className: "mt-5 grid gap-3 sm:grid-cols-2", children: [
                    _jsxs("div", { className: "rounded-lg border border-success/30 bg-success/5 p-3", children: [
                            _jsxs("h3", { className: "flex items-center gap-1.5 text-sm font-semibold", children: [
                                    _jsx(TrendingUp, { className: "h-3.5 w-3.5", "aria-hidden": true }),
                                    "What lifts the score"] }), positives.length > 0 ? (_jsx("ul", { className: "mt-2 space-y-1.5 text-sm text-muted-foreground", children: positives.map((r) => (_jsxs("li", { className: "flex gap-2", children: [
                                        _jsx(CheckCircle2, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 taas-fg-success", "aria-hidden": true }), _jsx("span", { children: r.text })
                                    ] }, r.id))) })) : (_jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "No evidenced strengths recorded yet." }))] }), _jsxs("div", { className: "rounded-lg border bg-muted/30 p-3", children: [
                            _jsxs("h3", { className: "flex items-center gap-1.5 text-sm font-semibold", children: [
                                    _jsx(TrendingDown, { className: "h-3.5 w-3.5", "aria-hidden": true }),
                                    "What holds it back"] }), watch.length > 0 ? (_jsx("ul", { className: "mt-2 space-y-1.5 text-sm text-muted-foreground", children: watch.map((r) => (_jsxs("li", { className: "flex gap-2", children: [
                                        _jsx(Info, { className: "mt-0.5 h-3.5 w-3.5 shrink-0", "aria-hidden": true }), _jsx("span", { children: r.text })
                                    ] }, r.id))) })) : (_jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "Nothing outstanding \u2014 every requirement carries evidence." }))] })
                ] })), _jsx("p", { className: "mt-4 text-[11px] text-muted-foreground", children: "Figures above are counts of quoted evidence from the background review. A rescore appends a new run rather than editing this one." })
        ] }));
});
