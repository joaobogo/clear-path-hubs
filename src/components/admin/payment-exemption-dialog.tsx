import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { grantPositionPaymentExemption } from "@/lib/admin-payments.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

/**
 * Admin-only. Never render this on a client surface.
 * Marks a role's payment as exempt with a written, audited reason — the honest
 * way to run a free pilot without faking a payment.
 */
export function PaymentExemptionDialog({
  positionId,
  paymentStatus,
}: {
  positionId: string;
  paymentStatus?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const grant = useServerFn(grantPositionPaymentExemption);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => grant({ data: { positionId, reason } }),
    onSuccess: () => {
      toast.success("Payment exemption recorded in the audit log.");
      setOpen(false);
      setReason("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (paymentStatus === "exempt") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Payment exempt (audited)
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldCheck className="mr-2 h-4 w-4" />
          Grant payment exemption
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant payment exemption</DialogTitle>
          <DialogDescription>
            This lets the role publish without a payment. It is recorded in the audit log with your
            name and the time. Clients never see this control.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this role exempt? e.g. Free pilot role agreed with the client on 12 Aug."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          {reason.trim().length < 10
            ? "A written reason of at least 10 characters is required."
            : "Reason will be stored permanently."}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 10 || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Recording…" : "Grant exemption"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
