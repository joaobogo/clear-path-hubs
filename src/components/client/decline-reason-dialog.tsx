import { useState } from "react";
import {
  DECLINE_REASONS,
  DECISION_NOTE_MAX,
  decisionReasonError,
} from "@/lib/client-decision-reasons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Every decline records a reason from the shared catalogue — no free-text-only
 * rejections, so a candidate always gets a real answer and the search can be
 * corrected.
 */
export function DeclineReasonDialog({
  open,
  onOpenChange,
  candidateName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidateName?: string | null;
  pending?: boolean;
  onConfirm: (v: { reasonCode: string; note: string }) => void;
}) {
  const [reasonCode, setReasonCode] = useState<string>("");
  const [note, setNote] = useState("");
  const error = decisionReasonError({ reasonRequired: true, reasonCode, note });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setReasonCode("");
          setNote("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Not moving forward</DialogTitle>
          <DialogDescription>
            {candidateName
              ? `Tell us why ${candidateName} is not a fit.`
              : "Tell us why this candidate is not a fit."}{" "}
            We use it to correct the search and to give the candidate a real answer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Reason</Label>
            <div className="grid gap-1.5">
              {DECLINE_REASONS.map((r) => (
                <label
                  key={r.code}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <input
                    type="radio"
                    name="decline-reason"
                    value={r.code}
                    checked={reasonCode === r.code}
                    onChange={() => setReasonCode(r.code)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="decline-note">
              Note {reasonCode === "other" ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="decline-note"
              value={note}
              maxLength={DECISION_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the recruiting team should know."
            />
          </div>

          {reasonCode && error && <p className="text-xs text-[color:var(--brand-danger)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            disabled={Boolean(error) || pending}
            onClick={() => onConfirm({ reasonCode, note: note.trim() })}
          >
            {pending ? "Recording…" : "Record decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
