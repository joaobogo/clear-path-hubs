import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Briefcase, CalendarClock, ChevronDown, ExternalLink, Linkedin, Lock as LockIcon, MapPin, } from "lucide-react";
import { DownloadCvButton } from "@/components/download-cv-button";
import { CvPreviewDialog } from "@/components/cv-preview-dialog";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
import { VisibilityNote } from "@/components/client/visibility-note";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatEnumLabel } from "@/lib/human-labels";
import { formatDateTime } from "@/lib/format/datetime";
export function BackLink() {
    return (_jsxs(Link, { to: "/client/candidates", className: "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground", children: [
            _jsx(ArrowLeft, { className: "h-3.5 w-3.5", "aria-hidden": true }),
            "All candidates"] }));
}
export function CandidateHeader({ candidate, readOnly, }) {
    const c = candidate.candidate;
    return (_jsxs("header", { className: "mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between", children: [
            _jsxs("div", { className: "min-w-0", children: [
                    _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                            _jsx("h1", { className: "truncate text-2xl font-semibold tracking-tight sm:text-3xl", children: c.display_name }), _jsx(CandidateScoreBadge, { score: candidate.score, fitLabel: candidate.fit_label, evidence: candidate.evidence_support, rechecking: candidate.freshness?.state === "stale", humanReviewed: candidate.human_review?.reviewed === true, evidencePending: candidate.explanation?.kind === "evidence_pending", unicorn: candidate.unicorn }), _jsx(Badge, { variant: "outline", className: "capitalize", children: formatEnumLabel(candidate.stage) })
                        ] }), c.headline && (_jsx("p", { className: "mt-1 text-base text-muted-foreground", children: c.headline })), candidate.explanation?.kind === "evidence_pending" ? (_jsxs("p", { className: "mt-1 text-sm text-muted-foreground italic", children: [candidate.explanation.headline, " \u2014 ", candidate.explanation.summary] })) : null, candidate.human_review?.statement && (_jsx("p", { className: "mt-1 text-sm text-primary", children: candidate.human_review.statement })), c.headline_chips.length > 0 && (_jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: c.headline_chips.map((chip) => (_jsx(Badge, { variant: "secondary", className: "font-normal", children: chip }, chip))) })), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground", children: [candidate.position && (_jsxs(Link, { to: "/client/positions/$id", params: { id: candidate.position.id }, className: "inline-flex items-center gap-1 text-foreground hover:underline", children: [
                                    _jsx(Briefcase, { className: "h-3.5 w-3.5", "aria-hidden": true }), candidate.position.title] })), (c.current_role || c.current_company) && (_jsx("span", { children: [c.current_role, c.current_company].filter(Boolean).join(" @ ") })), c.years_experience != null && (_jsxs("span", { children: [c.years_experience, "+ yrs experience"] })), c.location && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [
                                    _jsx(MapPin, { className: "h-3.5 w-3.5", "aria-hidden": true }), c.location] })), (c.timezone || c.availability) && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [
                                    _jsx(CalendarClock, { className: "h-3.5 w-3.5", "aria-hidden": true }), [c.timezone, c.availability].filter(Boolean).join(" · ")] }))] }), candidate.last_updated && (_jsxs("p", { className: "mt-2 text-xs text-muted-foreground", children: ["Last updated ", formatDateTime(candidate.last_updated)] }))] }), _jsx("div", { className: "flex flex-wrap items-center gap-2", children: readOnly && (_jsx(Badge, { variant: "secondary", className: "hidden sm:inline-flex", children: "Preview" })) }), _jsx(VisibilityNote, { className: "col-span-full mt-3" })
        ] }));
}
/**
 * The one contact surface on this page: identity contact details plus exactly
 * one CV preview and one CV download control.
 */
export function ContactBlock({ candidate }) {
    const c = candidate.candidate;
    const rows = [
        { label: "Email", value: c.email ? _jsx("a", { className: "text-primary hover:underline", href: `mailto:${c.email}`, children: c.email }) : null },
        { label: "Phone", value: c.phone ? _jsx("a", { className: "text-primary hover:underline", href: `tel:${c.phone}`, children: c.phone }) : null },
        {
            label: "LinkedIn",
            value: c.links.linkedin ? (_jsxs("a", { href: c.links.linkedin, target: "_blank", rel: "noopener noreferrer", className: "text-primary hover:underline", "aria-label": `Open LinkedIn profile for ${c.display_name} (opens in new tab)`, children: [
                    _jsx(Linkedin, { className: "mr-1 inline h-3.5 w-3.5", "aria-hidden": true }),
                    "View profile",
                    _jsx(ExternalLink, { className: "ml-1 inline h-3 w-3", "aria-hidden": true })
                ] })) : null,
        },
        { label: "Location", value: c.location ?? null },
    ];
    return (_jsxs("section", { "aria-labelledby": "contact-heading", className: "rounded-xl border bg-card p-4", children: [
            _jsx("h2", { id: "contact-heading", className: "text-sm font-semibold", children: "Contact" }), _jsx("dl", { className: "mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2", children: rows.map((r) => (_jsxs("div", { className: "grid grid-cols-[5.5rem_1fr] gap-2", children: [
                        _jsx("dt", { className: "text-xs text-muted-foreground", children: r.label }), _jsx("dd", { className: "min-w-0 truncate", children: r.value || _jsx("span", { className: "text-muted-foreground", children: "Not provided" }) })
                    ] }, r.label))) }), _jsx("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: candidate.contact_released ? (_jsxs(_Fragment, { children: [
                        _jsx(CvPreviewDialog, { matchId: candidate.match_id, candidateName: c.display_name }), _jsx(DownloadCvButton, { matchId: candidate.match_id, mode: "download" })
                    ] })) : (_jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground", children: [
                        _jsx(LockIcon, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true }),
                        "Contact details and CV are released as soon as a candidate is published."] })) })
        ] }));
}
export function SectionCard({ title, icon, description, action, children, }) {
    return (_jsxs("section", { className: "rounded-xl border bg-card p-4 sm:p-5", "aria-labelledby": `sec-${title}`, children: [
            _jsxs("header", { className: "mb-3 flex flex-wrap items-start justify-between gap-2", children: [
                    _jsxs("div", { children: [
                            _jsxs("h2", { id: `sec-${title}`, className: "flex items-center gap-2 text-sm font-semibold", children: [icon, title] }), description && (_jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: description }))] }), action] }), children] }));
}
export function Metric({ label, value, tone, }) {
    const bg = {
        emerald: "taas-bg-success-soft taas-fg-success ",
        amber: "taas-bg-warning-soft taas-fg-warning ",
        slate: "taas-bg-neutral-soft taas-fg-neutral ",
        sky: "taas-bg-info-soft taas-fg-info ",
    }[tone];
    return (_jsxs("div", { className: "rounded-md border p-3", children: [
            _jsx("div", { className: cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", bg), children: label }), _jsx("div", { className: "mt-1 text-lg font-semibold tabular-nums", children: value })
        ] }));
}
export function JumpNav({ items }) {
    return (_jsx("nav", { "aria-label": "Section navigation", className: "sticky top-14 z-20 -mx-4 overflow-x-auto border-y bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:mx-0 sm:rounded-lg sm:border", children: _jsx("ul", { className: "flex items-center gap-1 whitespace-nowrap text-xs", children: items.map((it) => (_jsx("li", { children: _jsx("a", { href: `#${it.id}`, className: "inline-flex min-h-11 items-center rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-0 sm:px-2.5", children: it.label }) }, it.id))) }) }));
}
/**
 * Collapsed-by-default detail block. The first screen stays high level; the
 * deep evidence lives behind these dropdowns further down the page.
 */
export function CollapsibleSection({ id, title, summary, defaultOpen = false, children, }) {
    return (_jsxs("details", { id: id, open: defaultOpen, className: "group scroll-mt-24 rounded-xl border bg-card [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-0", children: [
            _jsxs("summary", { className: "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5", children: [
                    _jsxs("span", { className: "min-w-0", children: [
                            _jsx("span", { className: "text-sm font-semibold", children: title }), summary && (_jsx("span", { className: "ml-2 text-xs text-muted-foreground", children: summary }))] }), _jsx(ChevronDown, { className: "h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180", "aria-hidden": true })
                ] }), _jsx("div", { className: "border-t px-4 py-4 sm:px-5", children: children })
        ] }));
}
