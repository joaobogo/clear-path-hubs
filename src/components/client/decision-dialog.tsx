import * as React from "react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DECISION_NOTE_MAX,
  DECLINE_REASONS,
  FEEDBACK_SIGNALS,
  HOLD_REASONS,
  INFO_REQUEST_TOPICS,
  decisionReasonError,
} from "@/lib/client-decision-reasons";

export type DecisionActionKey =
  | "shortlist"
  | "request_interview"
  | "request_more_information"
  | "hold"
  | "request_contact_release"
  | "submit_feedback"
  | "not_moving_forward"
  | "offer"
  | "hire";

export type DecisionPayload = {
  action: DecisionActionKey;
  feedback?: string;
  reasonCode?: string;
  signals?: string[];
};

type Config = {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  reasons?: readonly { code: string; label: string }[];
  reasonLabel?: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  signals?: boolean;
};

const CONFIG: Record<DecisionActionKey, Config> = {
  shortlist: {
    title: "Shortlist this candidate",
    description:
      "We will let the TaaSFlow team know you want to take this candidate further. Nothing is committed to the candidate yet.",
    confirmLabel: "Shortlist",
    notePlaceholder: "Optional note for the TaaSFlow team",
  },
  request_interview: {
    title: "Request an interview",
    description:
      "The TaaSFlow team will coordinate availability with the candidate and come back to you with times.",
    confirmLabel: "Request interview",
    notePlaceholder: "Preferred times, format, or who will attend (optional)",
  },
  request_more_information: {
    title: "Request more information",
    description: "Tell us what you need and we will go back to the candidate on your behalf.",
    confirmLabel: "Send request",
    reasons: INFO_REQUEST_TOPICS,
    reasonLabel: "What do you need?",
    notePlaceholder: "Add the specific question you want answered",
    noteRequired: true,
  },
  hold: {
    title: "Put this candidate on hold",
    description:
      "The candidate stays at the current stage. We will pause outreach until you decide.",
    confirmLabel: "Place on hold",
    reasons: HOLD_REASONS,
    reasonLabel: "Why are you holding?",
    notePlaceholder: "Optional context for the team",
  },
  request_contact_release: {
    title: "Request contact details",
    description:
      "Contact details are released by the TaaSFlow team once the candidate has agreed. We will confirm by message.",
    confirmLabel: "Request details",
    notePlaceholder: "Why you need direct contact (optional)",
  },
  submit_feedback: {
    title: "Add feedback",
    description:
      "Structured feedback helps us send you stronger candidates for this role. It is shared with the TaaSFlow team, not the candidate.",
    confirmLabel: "Save feedback",
    notePlaceholder: "What stood out, and what would you change?",
    noteRequired: true,
    signals: true,
  },
  not_moving_forward: {
    title: "Not a fit for this role",
    description:
      "This closes the candidate for this role only. We will handle the communication with the candidate respectfully.",
    confirmLabel: "Not a fit",
    destructive: true,
    reasons: DECLINE_REASONS,
    reasonLabel: "Main reason",
    notePlaceholder: "Anything else that would help us calibrate (optional)",
  },
  offer: {
    title: "Extend an offer",
    description: "The TaaSFlow team will prepare the offer documents and confirm the details with you before anything reaches the candidate.",
    confirmLabel: "Extend offer",
    notePlaceholder: "Offer context (optional)",
  },
  hire: {
    title: "Mark as hired",
    description: "This records the placement and notifies the TaaSFlow team to close the candidate's journey for this role.",
    confirmLabel: "Mark hired",
    notePlaceholder: "Start date or notes (optional)",
  },
};

export function DecisionDialog({
  action,
  open,
  pending,
  onOpenChange,
  onConfirm,
  extraReasons,
  extraReasonsLabel,
  banner,
}: {
  action: DecisionActionKey | null;
  open: boolean;
  pending: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (payload: DecisionPayload) => void;
  /** Role-specific reasons — the deal-breakers the client stated at intake. */
  extraReasons?: ReadonlyArray<{ code: string; label: string }>;
  extraReasonsLabel?: string;
  /** Inline prompt shown above the reasons, e.g. "add a deal-breaker". */
  banner?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [signals, setSignals] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setReason("");
      setNote("");
      setSignals([]);
    }
  }, [open, action]);

  if (!action) return null;
  const cfg = CONFIG[action];
  const needsReason = !!cfg.reasons;
  const noteRequired = cfg.noteRequired || reason === "other";
  const validation = decisionReasonError({
    reasonRequired: needsReason,
    reasonCode: reason || null,
    note,
  });
  // Actions that ask for their own free-text detail still require something.
  const missingRequiredNote = !!cfg.noteRequired && note.trim().length === 0;
  const invalid = !!validation || missingRequiredNote;

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-h-[85vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {banner}

          {cfg.reasons && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cfg.reasonLabel}
              </Label>
              <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
                {(extraReasons ?? []).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {extraReasonsLabel ?? "Your stated deal-breakers"}
                  </p>
                )}
                {(extraReasons ?? []).map((r) => (
                  <div key={r.code} className="flex items-start gap-2">
                    <RadioGroupItem value={r.code} id={`reason-${r.code}`} className="mt-0.5" />
                    <Label htmlFor={`reason-${r.code}`} className="text-sm font-normal leading-5">
                      {r.label}
                    </Label>
                  </div>
                ))}
                {cfg.reasons.map((r) => (
                  <div key={r.code} className="flex items-start gap-2">
                    <RadioGroupItem value={r.code} id={`reason-${r.code}`} className="mt-0.5" />
                    <Label htmlFor={`reason-${r.code}`} className="text-sm font-normal leading-5">
                      {r.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {cfg.signals && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What describes this candidate?
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {FEEDBACK_SIGNALS.map((s) => (
                  <label key={s.code} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={signals.includes(s.code)}
                      onCheckedChange={(v) =>
                        setSignals((prev) =>
                          v ? [...prev, s.code] : prev.filter((c) => c !== s.code),
                        )
                      }
                    />
                    <span className="leading-5">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="decision-note" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {noteRequired ? "Details (required)" : "Details (optional)"}
            </Label>
            <Textarea
              id="decision-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={cfg.notePlaceholder}
              maxLength={DECISION_NOTE_MAX}
              rows={4}
              aria-describedby="decision-note-count"
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {reason === "other" ? "Tell us in a sentence what did not fit." : "\u00a0"}
              </p>
              <span
                id="decision-note-count"
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
              >
                {note.length}/{DECISION_NOTE_MAX}
              </span>
            </div>
          </div>
        </div>

        {validation && (
          <p role="status" className="text-xs text-muted-foreground">
            {validation}
          </p>
        )}

        {/* Confirm sits under the thumb on a phone, above Cancel. */}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            className="w-full min-h-11 sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant={cfg.destructive ? "destructive" : "default"}
            className="w-full min-h-11 sm:w-auto"
            disabled={pending || invalid}
            onClick={() =>
              onConfirm({
                action,
                reasonCode: reason || undefined,
                feedback: note.trim() || undefined,
                signals: signals.length ? signals : undefined,
              })
            }
          >
            {pending ? "Saving…" : cfg.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
