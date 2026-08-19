import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatEnumLabel } from "@/lib/human-labels";
import { useMemo } from "react";
import { dualZone, liveSlots, relativeDay, viewerTimezone, calendarLink, } from "@/lib/scheduling";
import { buildIcs, downloadIcs } from "@/lib/availability";
import { canJoinInterview, displayInterviewStatus, interviewOccurrence, interviewStatusLabel, } from "@/lib/interview-timing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlotProposer } from "./slot-proposer";
import { AgeBadge } from "@/components/client/age-badge";
import { CalendarPlus, CheckCircle2, Circle, Clock, Download, RefreshCw, Sparkles, Video, XCircle, } from "lucide-react";
function marker(iv) {
    switch (displayInterviewStatus(iv)) {
        case "requested":
            return { dot: "taas-bg-warning-solid", label: interviewStatusLabel(iv), icon: Circle };
        case "scheduling":
            return { dot: "taas-bg-info-solid", label: interviewStatusLabel(iv), icon: Clock };
        case "scheduled":
            return { dot: "taas-bg-success-solid", label: interviewStatusLabel(iv), icon: CheckCircle2 };
        case "completed":
            return { dot: "taas-bg-neutral-solid", label: interviewStatusLabel(iv), icon: CheckCircle2 };
        default:
            return { dot: "taas-bg-danger-solid", label: interviewStatusLabel(iv), icon: XCircle };
    }
}
function anchor(iv) {
    const iso = iv.scheduled_at ??
        (iv.proposed_times.length > 0 ? iv.proposed_times[0] : null) ??
        iv.requested_at;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
}
function isPastItem(iv) {
    // Strictly temporal: a meeting in the future has not happened, whatever its
    // stored status claims. Cancelled meetings sit with the past either way.
    const occurrence = interviewOccurrence(iv);
    return occurrence === "happened" || occurrence === "cancelled";
}
/**
 * One timeline: proposed, confirmed and completed interviews on a single axis,
 * every time rendered in the interview timezone and the viewer's own.
 */
export function InterviewTimeline({ interviews, readOnly, hasWindows, onOpen, onProposeFromAvailability, onReschedule, busyId, timezone, proposingId, onStartPropose, onCancelPropose, onSubmitPropose, proposeSubmitting = false, proposeFailed = null, }) {
    const tz = viewerTimezone();
    const { upcoming, past } = useMemo(() => {
        const sorted = [...interviews].sort((a, b) => anchor(a) - anchor(b));
        return {
            upcoming: sorted.filter((i) => {
                if (isPastItem(i))
                    return false;
                // Suppress "Needs times" cards for candidates who are no longer in an 
                // interviewable stage (e.g. moved to Offer or Hired since the request).
                if (i.status === "requested" && i.next_action.includes("Move to interview stage")) {
                    return false;
                }
                return true;
            }),
            past: sorted.filter(isPastItem).reverse(),
        };
    }, [interviews]);
    const render = (iv) => (_jsx(TimelineItem, { interview: iv, viewerTz: tz, readOnly: readOnly, hasWindows: hasWindows, busy: busyId === iv.id, onOpen: () => onOpen(iv), onProposeFromAvailability: () => onProposeFromAvailability(iv), onReschedule: () => onReschedule(iv), timezone: timezone, proposing: proposingId === iv.id, proposeSubmitting: proposeSubmitting, proposeFailed: proposeFailed, onStartPropose: onStartPropose ? () => onStartPropose(iv) : undefined, onCancelPropose: onCancelPropose, onSubmitPropose: onSubmitPropose ? (p) => onSubmitPropose(iv, p) : undefined }, iv.id));
    return (_jsxs("div", { className: "space-y-6", children: [
            _jsxs("section", { children: [
                    _jsx("h2", { className: "text-sm font-medium text-muted-foreground", children: "Coming up" }), _jsx("div", { className: "mt-2 space-y-0", children: upcoming.length === 0 ? (_jsx("p", { className: "rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground", children: "Nothing scheduled yet." })) : (upcoming.map(render)) })
                ] }), past.length > 0 ? (_jsxs("section", { children: [
                    _jsx("h2", { className: "text-sm font-medium text-muted-foreground", children: "Already happened" }), _jsx("div", { className: "mt-2 space-y-0", children: past.map(render) })
                ] })) : null] }));
}
function TimelineItem({ interview: iv, viewerTz, readOnly, hasWindows, busy, onOpen, onProposeFromAvailability, onReschedule, timezone, proposing, proposeSubmitting, proposeFailed, onStartPropose, onCancelPropose, onSubmitPropose, }) {
    const m = marker(iv);
    const Icon = m.icon;
    const slots = liveSlots(iv.proposed_times, iv.availability_expires_at);
    const when = dualZone(iv.scheduled_at, iv.timezone, viewerTz);
    const title = `Interview — ${iv.position?.title ?? "Role"}`;
    // Action labels name the candidate and role so they stay unambiguous for
    // screen readers and stable as Playwright selectors.
    const subject = `${iv.candidate?.name ?? "candidate"} for ${iv.position?.title ?? "this role"}`;
    return (_jsxs("div", { id: `interview-${iv.id}`, className: "relative grid grid-cols-[auto_1fr] gap-3 pb-4 scroll-mt-24", children: [
            _jsxs("div", { className: "flex flex-col items-center", children: [
                    _jsx("span", { className: `mt-2 h-2.5 w-2.5 rounded-full ${m.dot}` }), _jsx("span", { className: "mt-1 w-px flex-1 bg-border" })
                ] }), _jsxs("div", { className: "rounded-lg border bg-card p-4", children: [
                    _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                            _jsxs("span", { className: "inline-flex items-center gap-1.5 text-xs font-medium", children: [
                                    _jsx(Icon, { className: "h-3.5 w-3.5" }),
                                    " ", m.label] }), iv.interview_type ? (_jsx(Badge, { variant: "outline", className: "capitalize font-normal", children: formatEnumLabel(iv.interview_type) })) : null, iv.reschedule_count > 0 ? (_jsxs(Badge, { variant: "outline", className: "font-normal", children: ["Rescheduled \u00D7", iv.reschedule_count] })) : null, iv.status === "requested" || iv.status === "scheduling" ? (_jsx(AgeBadge, { since: iv.created_at })) : null] }), _jsxs("button", { onClick: onOpen, className: "mt-1.5 block text-left", "aria-label": `Open interview details for ${subject}`, children: [
                            _jsx("span", { className: "font-medium", children: iv.candidate?.name ?? "Candidate" }), _jsx("span", { className: "mx-1.5 text-muted-foreground", children: "\u00B7" }), _jsx("span", { className: "text-muted-foreground", children: iv.position?.title ?? "Role" })
                        ] }), _jsxs("div", { className: "mt-2 space-y-1 text-sm", children: [iv.scheduled_at ? (_jsxs(_Fragment, { children: [
                                    _jsxs("div", { className: "inline-flex items-center gap-1.5", children: [
                                            _jsx(Clock, { className: "h-3.5 w-3.5 text-muted-foreground" }), _jsx("span", { className: "font-medium", children: when.primary }), _jsxs("span", { className: "text-muted-foreground", children: ["(", relativeDay(iv.scheduled_at, iv.timezone), ")"] })
                                        ] }), when.viewer ? (_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Your time: ", when.viewer] })) : null] })) : slots.length > 0 ? (_jsxs("div", { className: "text-muted-foreground", children: [slots.length, " time", slots.length === 1 ? "" : "s", " with the candidate \u2014 first option", " ", relativeDay(slots[0], iv.timezone)] })) : (_jsx("div", { className: "text-muted-foreground", children: "No times sent yet" })), iv.meeting_url && (interviewOccurrence(iv) === "upcoming" || canJoinInterview(iv)) ? (_jsxs("a", { href: iv.meeting_url, target: "_blank", rel: "noreferrer", className: "inline-flex items-center gap-1.5 text-primary hover:underline", children: [
                                    _jsx(Video, { className: "h-3.5 w-3.5" }),
                                    " Join link"] })) : null] }), proposing && onSubmitPropose ? (_jsx("div", { className: "mt-3 rounded-lg border bg-background p-3", children: _jsx(SlotProposer, { timezone: iv.timezone || timezone, submitting: proposeSubmitting, failed: proposeFailed, submitLabel: "Send proposed times", onCancel: () => onCancelPropose?.(), onSubmit: (p) => onSubmitPropose(p), initial: {
                                ...(iv.interview_type === "video_call" ||
                                    iv.interview_type === "phone_screen" ||
                                    iv.interview_type === "onsite"
                                    ? { format: iv.interview_type }
                                    : {}),
                                ...(iv.duration_minutes ? { durationMinutes: iv.duration_minutes } : {}),
                            } }) })) : null, _jsxs("div", { className: "mt-3 flex flex-wrap gap-2", children: [!readOnly && !proposing && iv.status === "requested" && onStartPropose ? (_jsxs(Button, { size: "sm", className: "min-h-11 sm:min-h-9", disabled: busy, onClick: onStartPropose, "aria-label": `Propose interview times for ${subject}`, children: [
                                    _jsx(Clock, { className: "mr-1.5 h-4 w-4" }),
                                    " Propose times"] })) : null, !readOnly && !proposing && iv.status === "requested" ? (_jsxs(Button, { size: "sm", className: "min-h-11 sm:min-h-9", disabled: busy || !hasWindows, onClick: onProposeFromAvailability, "aria-label": `Send my available times for ${subject}`, title: hasWindows ? undefined : "Set your availability first", children: [
                                    _jsx(Sparkles, { className: "mr-1.5 h-4 w-4" }), busy ? "Sending…" : "Send my available times"] })) : null, !readOnly && (iv.status === "scheduled" || iv.status === "scheduling") ? (_jsxs(Button, { size: "sm", variant: "outline", className: "min-h-11 sm:min-h-9", disabled: busy, onClick: onReschedule, "aria-label": `Reschedule interview for ${subject}`, children: [
                                    _jsx(RefreshCw, { className: "mr-1.5 h-4 w-4" }), busy ? "Working…" : "Reschedule"] })) : null, iv.scheduled_at ? (_jsxs(_Fragment, { children: [
                                    _jsxs(Button, { size: "sm", variant: "outline", onClick: () => downloadIcs(`interview-${iv.position?.reference ?? iv.id.slice(0, 6)}`, buildIcs({
                                            uid: iv.id,
                                            title,
                                            startIso: iv.scheduled_at,
                                            durationMinutes: iv.duration_minutes ?? 60,
                                            location: iv.meeting_url ?? iv.location,
                                        })), children: [
                                            _jsx(Download, { className: "mr-1.5 h-4 w-4" }),
                                            " Calendar invite"] }), _jsx("a", { href: calendarLink({
                                            title,
                                            startIso: iv.scheduled_at,
                                            durationMinutes: iv.duration_minutes ?? 60,
                                            location: iv.meeting_url ?? iv.location,
                                        }), target: "_blank", rel: "noreferrer", children: _jsxs(Button, { size: "sm", variant: "ghost", children: [
                                                _jsx(CalendarPlus, { className: "mr-1.5 h-4 w-4" }),
                                                " Google"] }) })
                                ] })) : null, _jsx(Button, { size: "sm", variant: "ghost", onClick: onOpen, children: "Details" })
                        ] })
                ] })
        ] }));
}
