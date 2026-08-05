// Close-role control for /client/positions/$id.
//
// The reason is required and never inferred. The dialog stays open with an error
// when the write fails, so a role is only ever shown as closed once the server
// has recorded it.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { closeRole } from "@/lib/role-closure.functions";
import {
  CLOSE_NOTE_MAX,
  CLOSE_REASONS,
  CLOSE_REASON_HELP,
  CLOSE_REASON_LABEL,
  validateCloseRole,
  type CloseRoleReason,
  type RoleClosureSummary,
} from "@/lib/role-closure";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Read-only record of a closure, shown once a role has been closed. */
export function RoleClosureRecord({ closure }: { closure: RoleClosureSummary }) {
  return (
    <section className="rounded-xl border bg-muted/30 p-4">
      <h2 className="text-sm font-semibold">
        {closure.paused ? "This role is on hold" : "This role is closed"}
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Reason</dt>
          <dd className="font-medium">{closure.reasonLabel}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Closed on</dt>
          <dd className="font-medium">{formatDate(closure.closedAt)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Closed by</dt>
          <dd className="font-medium">{closure.closedByName ?? "Unknown"}</dd>
        </div>
        {closure.restartExpectedOn && (
          <div>
            <dt className="text-muted-foreground">Expected restart</dt>
            <dd className="font-medium">{formatDate(closure.restartExpectedOn)}</dd>
          </div>
        )}
        {closure.note && (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Note</dt>
            <dd className="whitespace-pre-wrap">{closure.note}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Candidates, decisions and history for this role stay readable here.
      </p>
    </section>
  );
}

export function CloseRoleDialog({
  orgId,
  positionId,
  positionTitle,
  disabled = false,
}: {
  orgId: string;
  positionId: string;
  positionTitle?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CloseRoleReason | "">("");
  const [note, setNote] = useState("");
  const [restartDate, setRestartDate] = useState("");
  const [errors, setErrors] = useState<{ reason?: string; note?: string; restartDate?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const closeFn = useServerFn(closeRole);

  const mutation = useMutation({
    mutationFn: () =>
      closeFn({
        data: {
          orgId,
          positionId,
          reason: reason as CloseRoleReason,
          note: note.trim() || undefined,
          restartDate: reason === "on_hold" ? restartDate : undefined,
        },
      }),
    onSuccess: (result) => {
      setOpen(false);
      setFailure(null);
      toast.success(
        (result as { paused?: boolean }).paused
          ? "Role placed on hold"
          : "Role closed and recorded",
      );
      // One refresh, everywhere: counts, queues and lists all re-read.
      void queryClient.invalidateQueries();
    },
    onError: (err: unknown) => {
      // The role stays open — the close simply did not happen.
      setFailure(err instanceof Error ? err.message : "We couldn't close this role.");
    },
  });

  function submit() {
    const check = validateCloseRole({ reason, note, restartDate });
    setErrors(check.errors);
    if (!check.ok) return;
    setFailure(null);
    mutation.mutate();
  }

  return (
    <>
      <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        Close role
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (mutation.isPending) return;
          setOpen(next);
          if (!next) setFailure(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Close {positionTitle ? `“${positionTitle}”` : "this role"}</DialogTitle>
            <DialogDescription>
              Tell us why so your counts stay accurate. Nothing is deleted — the role stays
              readable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Reason</legend>
              <RadioGroup
                value={reason}
                onValueChange={(v) => {
                  setReason(v as CloseRoleReason);
                  setErrors((e) => ({ ...e, reason: undefined }));
                }}
                className="gap-2"
              >
                {CLOSE_REASONS.map((r) => (
                  <div key={r} className="flex items-start gap-3 rounded-lg border p-3">
                    <RadioGroupItem value={r} id={`close-reason-${r}`} className="mt-0.5" />
                    <div className="min-w-0">
                      <Label htmlFor={`close-reason-${r}`} className="font-medium">
                        {CLOSE_REASON_LABEL[r]}
                      </Label>
                      <p className="text-xs text-muted-foreground">{CLOSE_REASON_HELP[r]}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
              {errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
            </fieldset>

            {reason === "on_hold" && (
              <div className="space-y-1.5">
                <Label htmlFor="close-restart-date">Expected restart date</Label>
                <Input
                  id="close-restart-date"
                  type="date"
                  value={restartDate}
                  onChange={(e) => {
                    setRestartDate(e.target.value);
                    setErrors((x) => ({ ...x, restartDate: undefined }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  The role moves to your Paused list, not the archive.
                </p>
                {errors.restartDate && (
                  <p className="text-sm text-destructive">{errors.restartDate}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="close-note">Note (optional)</Label>
              <Textarea
                id="close-note"
                value={note}
                maxLength={CLOSE_NOTE_MAX}
                rows={3}
                placeholder="Anything the recruiting team should know."
                onChange={(e) => {
                  setNote(e.target.value);
                  setErrors((x) => ({ ...x, note: undefined }));
                }}
              />
              {errors.note && <p className="text-sm text-destructive">{errors.note}</p>}
            </div>

            {failure && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
              >
                <p className="font-medium">The role is still open — closing it failed.</p>
                <p className="text-muted-foreground">{failure}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={mutation.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {failure ? "Try again" : "Close role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
