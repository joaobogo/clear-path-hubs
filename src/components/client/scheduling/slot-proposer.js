import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import { DURATION_OPTIONS, MAX_SLOTS, MIN_NOTICE_HOURS, MIN_SLOTS, PROPOSAL_FORMATS, emptyProposal, localToIso, validateProposal, zoneLabel, } from "@/lib/interview-proposal";
import { formatInZone } from "@/lib/scheduling";
import { isPreferenceSet, preferenceSummary, slotFitsPreference, } from "@/lib/candidate/availability-preference";
/** The soonest value the pickers will accept, as a `datetime-local` string. */
function minLocalValue() {
    const d = new Date(Date.now() + MIN_NOTICE_HOURS * 3600000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/**
 * Prompt 10 — propose times inline: three slots, attendees, format.
 * The client never touches the candidate's calendar or contact details; the
 * recruiting team confirms the slot.
 */
export function SlotProposer({ timezone, submitting, failed, onSubmit, onCancel, initial, submitLabel = "Send proposed times", candidatePreference, }) {
    const [draft, setDraft] = useState(() => ({
        ...emptyProposal(timezone),
        ...initial,
    }));
    const [errors, setErrors] = useState({});
    const min = minLocalValue();
    // Keep the zone in step when the org's stored timezone loads late.
    useEffect(() => {
        setDraft((d) => (d.timezone ? d : { ...d, timezone }));
    }, [timezone]);
    const patch = (p) => setDraft((d) => ({ ...d, ...p }));
    const submit = () => {
        const result = validateProposal(draft);
        setErrors(result.errors);
        if (!result.valid)
            return;
        onSubmit({
            format: draft.format,
            durationMinutes: draft.durationMinutes,
            timezone: draft.timezone,
            slotsIso: result.slotsIso,
            attendees: result.attendees,
            ...(draft.notes?.trim() ? { notes: draft.notes.trim() } : {}),
        });
    };
    return (_jsxs("div", { className: "space-y-4", "aria-busy": submitting, children: [
            _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [
                    _jsxs("div", { children: [
                            _jsx("label", { htmlFor: "proposal-format", className: "text-sm font-medium", children: "Format" }), _jsxs(Select, { value: draft.format, onValueChange: (v) => patch({ format: v }), disabled: submitting, children: [
                                    _jsx(SelectTrigger, { id: "proposal-format", className: "mt-1", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: PROPOSAL_FORMATS.map((f) => (_jsx(SelectItem, { value: f.value, children: f.label }, f.value))) })
                                ] })
                        ] }), _jsxs("div", { children: [
                            _jsx("label", { htmlFor: "proposal-duration", className: "text-sm font-medium", children: "Duration" }), _jsxs(Select, { value: String(draft.durationMinutes), onValueChange: (v) => patch({ durationMinutes: Number(v) }), disabled: submitting, children: [
                                    _jsx(SelectTrigger, { id: "proposal-duration", className: "mt-1", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: DURATION_OPTIONS.map((d) => (_jsxs(SelectItem, { value: String(d), children: [d, " minutes"] }, d))) })
                                ] }), errors.duration ? (_jsx("p", { className: "mt-1 text-xs text-destructive", children: errors.duration })) : null] }), _jsxs("div", { children: [
                            _jsx("label", { htmlFor: "proposal-timezone", className: "text-sm font-medium", children: "Timezone" }), _jsx(Input, { id: "proposal-timezone", className: "mt-1", value: draft.timezone, disabled: submitting, onChange: (e) => patch({ timezone: e.target.value }) }), errors.timezone ? (_jsx("p", { className: "mt-1 text-xs text-destructive", children: errors.timezone })) : (_jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: zoneLabel(draft.timezone) }))] })
                ] }), isPreferenceSet(candidatePreference ?? null) ? (_jsxs("div", { className: "rounded-md border bg-muted/40 p-3", children: [
                    _jsx("p", { className: "text-xs font-medium", children: "When the candidate said interviews usually suit" }), preferenceSummary(candidatePreference ?? null).map((line) => (_jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: line }, line))), _jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "A preference, not a commitment \u2014 you can offer other times." })
                ] })) : null, _jsxs("fieldset", { disabled: submitting, className: "min-w-0", children: [
                    _jsx("legend", { className: "text-sm font-medium", children: "Times you can offer" }), _jsxs("p", { className: "mt-0.5 text-xs text-muted-foreground", children: ["Offer ", MIN_SLOTS, " or ", MAX_SLOTS, " times, each at least ", MIN_NOTICE_HOURS, " hours ahead. Read in ", zoneLabel(draft.timezone), "."] }), _jsx("div", { className: "mt-2 space-y-2", children: draft.slots.map((slot, i) => {
                            const iso = slot ? localToIso(slot, draft.timezone) : null;
                            const slotError = errors.slotAt?.[i];
                            return (_jsxs("div", { children: [
                                    _jsxs("div", { className: "flex items-center gap-2", children: [
                                            _jsx(Input, { type: "datetime-local", min: min, "aria-label": `Option ${i + 1}`, "aria-invalid": slotError ? true : undefined, value: slot, onChange: (e) => patch({
                                                    slots: draft.slots.map((v, idx) => (idx === i ? e.target.value : v)),
                                                }) }), draft.slots.length > MIN_SLOTS ? (_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "min-h-11 min-w-11 shrink-0", "aria-label": `Remove option ${i + 1}`, onClick: () => patch({ slots: draft.slots.filter((_, idx) => idx !== i) }), children: _jsx(X, { className: "h-4 w-4", "aria-hidden": true }) })) : null] }), slotError ? (_jsx("p", { className: "mt-1 text-xs text-destructive", children: slotError })) : iso ? (_jsxs("p", { className: "mt-1 text-xs text-muted-foreground", children: [formatInZone(iso, draft.timezone), isPreferenceSet(candidatePreference ?? null) &&
                                                !slotFitsPreference(iso, candidatePreference ?? null)
                                                ? " · outside their stated preference"
                                                : ""] })) : null] }, i));
                        }) }), draft.slots.length < MAX_SLOTS ? (_jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "mt-2", onClick: () => patch({ slots: [...draft.slots, ""] }), children: [
                            _jsx(Plus, { className: "mr-1 h-3 w-3", "aria-hidden": true }),
                            " Add another option"] })) : null, errors.slots ? _jsx("p", { className: "mt-1 text-xs text-destructive", children: errors.slots }) : null] }), _jsxs("fieldset", { disabled: submitting, className: "min-w-0", children: [
                    _jsx("legend", { className: "text-sm font-medium", children: "Who from your team joins" }), _jsx("div", { className: "mt-2 space-y-2", children: draft.attendees.map((a, i) => {
                            const err = errors.attendeeAt?.[i];
                            return (_jsxs("div", { children: [
                                    _jsxs("div", { className: "grid gap-2 sm:grid-cols-[1fr_1.3fr_auto]", children: [
                                            _jsx(Input, { "aria-label": `Attendee ${i + 1} name`, placeholder: "Name", value: a.name, onChange: (e) => patch({
                                                    attendees: draft.attendees.map((v, idx) => idx === i ? { ...v, name: e.target.value } : v),
                                                }) }), _jsx(Input, { type: "email", "aria-label": `Attendee ${i + 1} email`, "aria-invalid": err ? true : undefined, placeholder: "name@company.com", value: a.email, onChange: (e) => patch({
                                                    attendees: draft.attendees.map((v, idx) => idx === i ? { ...v, email: e.target.value } : v),
                                                }) }), draft.attendees.length > 1 ? (_jsx(Button, { type: "button", variant: "ghost", size: "icon", className: "min-h-11 min-w-11", "aria-label": `Remove attendee ${i + 1}`, onClick: () => patch({ attendees: draft.attendees.filter((_, idx) => idx !== i) }), children: _jsx(X, { className: "h-4 w-4", "aria-hidden": true }) })) : null] }), err ? _jsx("p", { className: "mt-1 text-xs text-destructive", children: err }) : null] }, i));
                        }) }), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", className: "mt-2", onClick: () => patch({ attendees: [...draft.attendees, { name: "", email: "" }] }), children: [
                            _jsx(Plus, { className: "mr-1 h-3 w-3", "aria-hidden": true }),
                            " Add attendee"] }), errors.attendees ? (_jsx("p", { className: "mt-1 text-xs text-destructive", children: errors.attendees })) : null] }), _jsxs("div", { children: [
                    _jsx("label", { htmlFor: "proposal-notes", className: "text-sm font-medium", children: "Anything we should tell the candidate?" }), _jsx(Textarea, { id: "proposal-notes", className: "mt-1", rows: 2, maxLength: 1000, disabled: submitting, placeholder: "Address, panel names, what to prepare\u2026", value: draft.notes ?? "", onChange: (e) => patch({ notes: e.target.value }) })
                ] }), failed ? (_jsx("p", { role: "alert", className: "text-sm text-destructive", children: failed })) : null, _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
                    _jsx(Button, { type: "button", onClick: submit, disabled: submitting, children: submitting ? (_jsxs(_Fragment, { children: [
                                _jsx(Loader2, { className: "mr-1.5 h-4 w-4 animate-spin", "aria-hidden": true }),
                                " Sending\u2026"] })) : (submitLabel) }), onCancel ? (_jsx(Button, { type: "button", variant: "ghost", onClick: onCancel, disabled: submitting, children: "Cancel" })) : null, _jsx("span", { className: "text-xs text-muted-foreground", children: "We confirm the slot with the candidate \u2014 no emails leave your account." })
                ] })
        ] }));
}
