import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import {
  DURATION_OPTIONS,
  MAX_SLOTS,
  MIN_NOTICE_HOURS,
  MIN_SLOTS,
  PROPOSAL_FORMATS,
  emptyProposal,
  localToIso,
  validateProposal,
  zoneLabel,
  type ProposalDraft,
  type ProposalErrors,
  type ProposalFormat,
} from "@/lib/interview-proposal";
import { formatInZone } from "@/lib/scheduling";
import {
  isPreferenceSet,
  preferenceSummary,
  slotFitsPreference,
  type AvailabilityPreference,
} from "@/lib/candidate/availability-preference";

export type ProposalSubmission = {
  format: ProposalFormat;
  durationMinutes: number;
  timezone: string;
  slotsIso: string[];
  attendees: { name: string; email: string; role?: string }[];
  notes?: string;
};

/** The soonest value the pickers will accept, as a `datetime-local` string. */
function minLocalValue(): string {
  const d = new Date(Date.now() + MIN_NOTICE_HOURS * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Prompt 10 — propose times inline: three slots, attendees, format.
 * The client never touches the candidate's calendar or contact details; the
 * recruiting team confirms the slot.
 */
export function SlotProposer({
  timezone,
  submitting,
  failed,
  onSubmit,
  onCancel,
  initial,
  submitLabel = "Send proposed times",
  candidatePreference,
}: {
  timezone: string;
  submitting: boolean;
  /** Set when the last attempt failed — values stay put, message is explicit. */
  failed?: string | null;
  onSubmit: (payload: ProposalSubmission) => void;
  onCancel?: () => void;
  initial?: Partial<ProposalDraft>;
  submitLabel?: string;
  /** What the candidate said generally works. A preference, not a commitment. */
  candidatePreference?: AvailabilityPreference | null;
}) {
  const [draft, setDraft] = useState<ProposalDraft>(() => ({
    ...emptyProposal(timezone),
    ...initial,
  }));
  const [errors, setErrors] = useState<ProposalErrors>({});
  const min = minLocalValue();

  // Keep the zone in step when the org's stored timezone loads late.
  useEffect(() => {
    setDraft((d) => (d.timezone ? d : { ...d, timezone }));
  }, [timezone]);

  const patch = (p: Partial<ProposalDraft>) => setDraft((d) => ({ ...d, ...p }));

  const submit = () => {
    const result = validateProposal(draft);
    setErrors(result.errors);
    if (!result.valid) return;
    onSubmit({
      format: draft.format,
      durationMinutes: draft.durationMinutes,
      timezone: draft.timezone,
      slotsIso: result.slotsIso,
      attendees: result.attendees,
      ...(draft.notes?.trim() ? { notes: draft.notes.trim() } : {}),
    });
  };

  return (
    <div className="space-y-4" aria-busy={submitting}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="proposal-format" className="text-sm font-medium">
            Format
          </label>
          <Select
            value={draft.format}
            onValueChange={(v) => patch({ format: v as ProposalFormat })}
            disabled={submitting}
          >
            <SelectTrigger id="proposal-format" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROPOSAL_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="proposal-duration" className="text-sm font-medium">
            Duration
          </label>
          <Select
            value={String(draft.durationMinutes)}
            onValueChange={(v) => patch({ durationMinutes: Number(v) })}
            disabled={submitting}
          >
            <SelectTrigger id="proposal-duration" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.duration ? (
            <p className="mt-1 text-xs text-destructive">{errors.duration}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="proposal-timezone" className="text-sm font-medium">
            Timezone
          </label>
          <Input
            id="proposal-timezone"
            className="mt-1"
            value={draft.timezone}
            disabled={submitting}
            onChange={(e) => patch({ timezone: e.target.value })}
          />
          {errors.timezone ? (
            <p className="mt-1 text-xs text-destructive">{errors.timezone}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{zoneLabel(draft.timezone)}</p>
          )}
        </div>
      </div>

      {isPreferenceSet(candidatePreference ?? null) ? (
        <div className="rounded-md border bg-muted/40 p-3">
          <p className="text-xs font-medium">When the candidate said interviews usually suit</p>
          {preferenceSummary(candidatePreference ?? null).map((line) => (
            <p key={line} className="mt-0.5 text-xs text-muted-foreground">
              {line}
            </p>
          ))}
          <p className="mt-1 text-xs text-muted-foreground">
            A preference, not a commitment — you can offer other times.
          </p>
        </div>
      ) : null}

      <fieldset disabled={submitting} className="min-w-0">
        <legend className="text-sm font-medium">Times you can offer</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick {MAX_SLOTS} — at least {MIN_SLOTS}, each {MIN_NOTICE_HOURS} hours ahead or more. Read
          in {zoneLabel(draft.timezone)}.
        </p>
        <div className="mt-2 space-y-2">
          {draft.slots.map((slot, i) => {
            const iso = slot ? localToIso(slot, draft.timezone) : null;
            const slotError = errors.slotAt?.[i];
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <Input
                    type="datetime-local"
                    min={min}
                    aria-label={`Option ${i + 1}`}
                    aria-invalid={slotError ? true : undefined}
                    value={slot}
                    onChange={(e) =>
                      patch({
                        slots: draft.slots.map((v, idx) => (idx === i ? e.target.value : v)),
                      })
                    }
                  />
                  {draft.slots.length > MIN_SLOTS ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-11 min-w-11 shrink-0"
                      aria-label={`Remove option ${i + 1}`}
                      onClick={() =>
                        patch({ slots: draft.slots.filter((_, idx) => idx !== i) })
                      }
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
                {slotError ? (
                  <p className="mt-1 text-xs text-destructive">{slotError}</p>
                ) : iso ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatInZone(iso, draft.timezone)}
                    {isPreferenceSet(candidatePreference ?? null) &&
                    !slotFitsPreference(iso, candidatePreference ?? null)
                      ? " · outside their stated preference"
                      : ""}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {draft.slots.length < MAX_SLOTS ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => patch({ slots: [...draft.slots, ""] })}
          >
            <Plus className="mr-1 h-3 w-3" aria-hidden /> Add another option
          </Button>
        ) : null}
        {errors.slots ? <p className="mt-1 text-xs text-destructive">{errors.slots}</p> : null}
      </fieldset>

      <fieldset disabled={submitting} className="min-w-0">
        <legend className="text-sm font-medium">Who from your team joins</legend>
        <div className="mt-2 space-y-2">
          {draft.attendees.map((a, i) => {
            const err = errors.attendeeAt?.[i];
            return (
              <div key={i}>
                <div className="grid gap-2 sm:grid-cols-[1fr_1.3fr_auto]">
                  <Input
                    aria-label={`Attendee ${i + 1} name`}
                    placeholder="Name"
                    value={a.name}
                    onChange={(e) =>
                      patch({
                        attendees: draft.attendees.map((v, idx) =>
                          idx === i ? { ...v, name: e.target.value } : v,
                        ),
                      })
                    }
                  />
                  <Input
                    type="email"
                    aria-label={`Attendee ${i + 1} email`}
                    aria-invalid={err ? true : undefined}
                    placeholder="name@company.com"
                    value={a.email}
                    onChange={(e) =>
                      patch({
                        attendees: draft.attendees.map((v, idx) =>
                          idx === i ? { ...v, email: e.target.value } : v,
                        ),
                      })
                    }
                  />
                  {draft.attendees.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="min-h-11 min-w-11"
                      aria-label={`Remove attendee ${i + 1}`}
                      onClick={() =>
                        patch({ attendees: draft.attendees.filter((_, idx) => idx !== i) })
                      }
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
                {err ? <p className="mt-1 text-xs text-destructive">{err}</p> : null}
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => patch({ attendees: [...draft.attendees, { name: "", email: "" }] })}
        >
          <Plus className="mr-1 h-3 w-3" aria-hidden /> Add attendee
        </Button>
        {errors.attendees ? (
          <p className="mt-1 text-xs text-destructive">{errors.attendees}</p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor="proposal-notes" className="text-sm font-medium">
          Anything we should tell the candidate?
        </label>
        <Textarea
          id="proposal-notes"
          className="mt-1"
          rows={2}
          maxLength={1000}
          disabled={submitting}
          placeholder="Address, panel names, what to prepare…"
          value={draft.notes ?? ""}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-destructive">
          {failed}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> Sending…
            </>
          ) : (
            submitLabel
          )}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          We confirm the slot with the candidate — no emails leave your account.
        </span>
      </div>
    </div>
  );
}
