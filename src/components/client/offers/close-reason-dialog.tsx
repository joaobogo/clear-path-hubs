import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  transitionHire,
  CLOSE_REASON_LABEL,
  HIRE_STATUS_LABEL,
  type HireStatus,
  type HireCloseReason,
} from "@/lib/hires.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "./field";

// Owns its own reason/notes form state; the parent supplies the target
// hire id + status and callbacks for close/save.
export function CloseReasonDialog({
  orgId,
  hireId,
  target,
  onClose,
  onSaved,
}: {
  orgId: string;
  hireId: string;
  target: HireStatus;
  onClose: () => void;
  onSaved: () => void;
}) {
  const transitionFn = useServerFn(transitionHire);
  const [reason, setReason] = useState<HireCloseReason>("candidate_declined");
  const [notes, setNotes] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      transitionFn({
        data: {
          orgId,
          id: hireId,
          to: target,
          close_reason: reason,
          close_reason_notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`Marked as ${HIRE_STATUS_LABEL[target]}`);
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target === "offer_declined" ? "Record decline" : "Close lost"}
          </DialogTitle>
          <DialogDescription>
            Capture why this offer didn&apos;t land — it feeds the close-reason
            report and future rediscovery.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Reason">
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as HireCloseReason)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CLOSE_REASON_LABEL) as HireCloseReason[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CLOSE_REASON_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes (optional)">
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Counter offer at €X, timing mismatch on start date, …"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
