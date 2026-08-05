// One reject dialog for every admin reject action. A rejection cannot be
// submitted without a controlled reason; on failure the dialog stays open and
// shows the error so the reason typed is never lost.
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
import { ADMIN_REJECTION_REASONS } from "@/lib/client-decision-reasons";

export function RejectReasonDialog({
  open,
  onOpenChange,
  title = "Reject this candidate",
  description = "The candidate is removed from the client view and archived on this job. The reason is recorded against the decision.",
  confirmLabel = "Reject candidate",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Throw to keep the dialog open and surface the failure. */
  onConfirm: (payload: { reasonCode: string; detail?: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setDetail("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const detailRequired = reason === "other";
  const invalid = !reason || (detailRequired && detail.trim().length === 0);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm({ reasonCode: reason, detail: detail.trim() || undefined });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The rejection could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reason (required)
            </Label>
            <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
              {ADMIN_REJECTION_REASONS.map((r) => (
                <div key={r.code} className="flex items-start gap-2">
                  <RadioGroupItem value={r.code} id={`reject-${r.code}`} className="mt-0.5" />
                  <Label htmlFor={`reject-${r.code}`} className="text-sm font-normal leading-5">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="reject-detail"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {detailRequired ? "Detail (required)" : "Detail (optional)"}
            </Label>
            <Textarea
              id="reject-detail"
              rows={4}
              maxLength={1000}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="What specifically drove this decision?"
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy || invalid} onClick={() => void submit()}>
            {busy ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
