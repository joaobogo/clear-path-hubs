import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  convertIntakeToPosition,
  rejectIntake,
  requestIntakeClarification,
} from "@/lib/intake-admin.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toastError } from "@/lib/toast-error";

type Mode = null | "convert" | "clarify" | "reject";

/**
 * Row-level actions for the intake inbox, so the three verbs promised in the
 * page subtitle (convert, request clarification, reject) are reachable without
 * opening the record first.
 */
export function IntakeRowActions({
  id,
  company,
  role,
  closed,
}: {
  id: string;
  company: string;
  role: string;
  closed: boolean;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");

  const convert = useServerFn(convertIntakeToPosition);
  const clarify = useServerFn(requestIntakeClarification);
  const reject = useServerFn(rejectIntake);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin", "intake-inbox"] });
    await qc.invalidateQueries({ queryKey: ["admin", "intake-aging"] });
  };

  const close = () => {
    setMode(null);
    setText("");
  };

  const convertM = useMutation({
    mutationFn: () => convert({ data: { id } }),
    onSuccess: async () => {
      toast.success(`${company} converted to a role.`);
      close();
      await invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const clarifyM = useMutation({
    mutationFn: () => clarify({ data: { id, note: text.trim() } }),
    onSuccess: async () => {
      toast.success("Clarification requested. The contact has been emailed.");
      close();
      await invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const rejectM = useMutation({
    mutationFn: () => reject({ data: { id, reason: text.trim() } }),
    onSuccess: async () => {
      toast.success("Intake rejected.");
      close();
      await invalidate();
    },
    onError: (e: Error) => toastError(e),
  });

  const busy = convertM.isPending || clarifyM.isPending || rejectM.isPending;

  if (closed) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => setMode("convert")}>
          Convert
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode("clarify")}>
          Ask for details
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => setMode("reject")}
        >
          Reject
        </Button>
      </div>

      <AlertDialog open={mode === "convert"} onOpenChange={(o) => (o ? null : close())}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert this brief to a role?</AlertDialogTitle>
            <AlertDialogDescription>
              Creates a draft role for {role} at {company} and links it to this brief. The
              brief then leaves the inbox. This is audited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={convertM.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={convertM.isPending}
              onClick={(e) => {
                e.preventDefault();
                convertM.mutate();
              }}
            >
              {convertM.isPending ? "Converting…" : "Convert to role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={mode === "clarify" || mode === "reject"}
        onOpenChange={(o) => (o ? null : close())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "reject" ? "Reject this brief" : "Ask for missing details"}
            </DialogTitle>
            <DialogDescription>
              {mode === "reject"
                ? "Closes the submission. The reason is required and audited."
                : "Your question is emailed to the contact and logged on the record."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === "reject" ? "Why are you closing this brief?" : "What information is missing?"
            }
            aria-label={mode === "reject" ? "Reason for rejection" : "Question for the contact"}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant={mode === "reject" ? "destructive" : "default"}
              disabled={text.trim().length < 3 || busy}
              onClick={() => (mode === "reject" ? rejectM.mutate() : clarifyM.mutate())}
            >
              {mode === "reject"
                ? rejectM.isPending
                  ? "Rejecting…"
                  : "Reject brief"
                : clarifyM.isPending
                  ? "Sending…"
                  : "Send question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
