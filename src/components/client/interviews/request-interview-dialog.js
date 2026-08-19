import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlotProposer } from "@/components/client/scheduling/slot-proposer";
import { QueryErrorCard } from "@/components/client/query-error";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
export function RequestInterviewDialog({ orgId, onClose, onSubmit, submitting, failed, fetchCandidates, timezone, initialMatchId, }) {
    const candidatesQ = useQuery({
        queryKey: ["client-schedulable", orgId],
        queryFn: fetchCandidates,
    });
    const [matchId, setMatchId] = useState(initialMatchId ?? "");
    const [candidateError, setCandidateError] = useState(null);
    const candidates = candidatesQ.data?.candidates ?? [];
    return (_jsx(Dialog, { open: true, onOpenChange: (v) => !v && onClose(), children: _jsxs(DialogContent, { className: "max-h-[90vh] max-w-2xl overflow-y-auto", children: [
                _jsxs(DialogHeader, { children: [
                        _jsx(DialogTitle, { children: "Propose interview times" }), _jsx(DialogDescription, { children: "Offer times and say who joins. We confirm one with the candidate \u2014 no back-and-forth from your inbox." })
                    ] }), _jsxs("div", { className: "space-y-4", children: [
                        _jsxs("div", { children: [
                                _jsx("label", { htmlFor: "request-candidate", className: "text-sm font-medium", children: "Candidate" }), candidatesQ.isError ? (_jsx(QueryErrorCard, { title: "We couldn't load your candidates", error: candidatesQ.error, onRetry: () => candidatesQ.refetch(), retrying: candidatesQ.isFetching, compact: true, className: "mt-1" })) : (_jsxs(Select, { value: matchId, onValueChange: (v) => {
                                        setMatchId(v);
                                        setCandidateError(null);
                                    }, disabled: submitting, children: [
                                        _jsx(SelectTrigger, { id: "request-candidate", className: "mt-1", children: _jsx(SelectValue, { placeholder: "Select a candidate" }) }), _jsx(SelectContent, { children: candidatesQ.isLoading ? (_jsx("div", { className: "p-3 text-sm text-muted-foreground", children: "Loading candidates\u2026" })) : candidates.length === 0 ? (_jsx("div", { className: "p-3 text-sm text-muted-foreground", children: "No delivered candidates available." })) : (candidates.map((c) => {
                                                const isInterviewable = ["delivered", "shortlisted", "interview_process"].includes(c.stage);
                                                const isDisabled = c.has_active_interview || !isInterviewable;
                                                return (_jsxs(SelectItem, { value: c.match_id, disabled: isDisabled, children: [c.candidate_name, " \u2014 ", c.position_title, c.has_active_interview ? " · (has active interview)" : "", !isInterviewable ? ` · (${formatEnumLabel(c.stage)})` : ""] }, c.match_id));
                                            })) })
                                    ] })), candidateError ? (_jsx("p", { className: "mt-1 text-xs text-destructive", children: candidateError })) : null] }), _jsx(SlotProposer, { timezone: timezone, candidatePreference: candidates.find((c) => c.match_id === matchId)?.availability_preference ?? null, submitting: submitting, failed: failed, onCancel: onClose, submitLabel: "Send proposed times", onSubmit: (p) => {
                                if (!matchId) {
                                    setCandidateError("Choose a candidate first.");
                                    return;
                                }
                                onSubmit({
                                    orgId,
                                    matchId,
                                    interviewType: p.format,
                                    timezone: p.timezone,
                                    durationMinutes: p.durationMinutes,
                                    proposedTimes: p.slotsIso,
                                    participants: p.attendees,
                                    ...(p.notes ? { notes: p.notes } : {}),
                                });
                            } })
                    ] })
            ] }) }));
}
