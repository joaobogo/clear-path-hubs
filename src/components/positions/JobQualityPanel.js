import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Job-quality indicator: names the missing decision-critical information
// instead of showing an arbitrary completeness percentage.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getRequisitionQuality } from "@/lib/requisition.functions";
import { assessJobQuality } from "@/lib/requisition-schema";
const TONE = {
    not_scoreable: "border-destructive/40 bg-destructive/5",
    scoreable_with_gaps: "border-amber-500/40 bg-amber-500/5",
    decision_ready: "border-emerald-500/40 bg-emerald-500/5",
};
function GapList({ title, gaps, onJumpToStep, editTo, }) {
    if (gaps.length === 0)
        return null;
    return (_jsxs("div", { className: "space-y-1.5", children: [
            _jsx("p", { className: "text-xs font-medium uppercase tracking-wide text-muted-foreground", children: title }), _jsx("ul", { className: "space-y-1.5", children: gaps.map((g) => (_jsxs("li", { className: "flex flex-wrap items-start justify-between gap-2 text-sm", children: [
                        _jsxs("span", { className: "min-w-0", children: [
                                _jsx("span", { className: "font-medium", children: g.label }), _jsx("span", { className: "block text-xs text-muted-foreground", children: g.why })
                            ] }), g.step && onJumpToStep ? (_jsxs(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => onJumpToStep(g.step), children: ["Fix in step ", g.step] })) : g.step && editTo ? (_jsx(Button, { asChild: true, size: "sm", variant: "ghost", children: _jsx(Link, { to: editTo.to, params: { id: editTo.positionId }, search: { step: g.step }, children: "Fix this" }) })) : null] }, g.id))) })
        ] }));
}
export function JobQualityPanel({ positionId, onJumpToStep, compact, editTo, draft, }) {
    const load = useServerFn(getRequisitionQuality);
    const { data, isLoading } = useQuery({
        queryKey: ["requisition-quality", positionId],
        queryFn: () => load({ data: { id: positionId } }),
    });
    const view = useMemo(() => {
        if (!data)
            return null;
        if (!draft)
            return data;
        const merged = { ...data.input, ...draft };
        return { ...assessJobQuality(merged), input: merged };
    }, [data, draft]);
    if (isLoading || !view) {
        return _jsx("p", { className: "text-sm text-muted-foreground", children: "Checking job quality\u2026" });
    }
    return (_jsxs("div", { className: `rounded-md border p-3 ${TONE[view.readiness]}`, children: [
            _jsx("p", { className: "text-sm font-medium", children: view.summary }), !compact && (_jsxs("div", { className: "mt-3 space-y-3", children: [
                    _jsx(GapList, { title: "Blocks accurate scoring", gaps: view.blocking, onJumpToStep: onJumpToStep, editTo: editTo }), _jsx(GapList, { title: "Weakens shortlist accuracy", gaps: view.degrades, onJumpToStep: onJumpToStep, editTo: editTo }), _jsx(GapList, { title: "Nice to have", gaps: view.optional, onJumpToStep: onJumpToStep, editTo: editTo })
                ] }))] }));
}
