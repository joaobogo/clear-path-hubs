import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { requestCustomDashboard } from "@/lib/dashboards.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toastError } from "@/lib/toast-error";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RequestDialog({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const requestFn = useServerFn(requestCustomDashboard);

  const submit = useMutation({
    mutationFn: () => requestFn({ data: { orgId, description: description.trim() } }),
    onSuccess: (res) => {
      if ("error" in res) return toast.error(res.error);
      toast.success("Sent. We'll come back with scope and a price.");
      setOpen(false);
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["dashboard-workspace", orgId] });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't submit. Nothing was saved — please try again." }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Ask for a custom dashboard</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tell us what you need to see</DialogTitle>
          <DialogDescription>
            Describe the decision you're trying to make. We'll scope it, price it, and build it —
            it's chargeable work, so you'll always see the number before we start.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Every Monday I need to know which roles are behind, why, and what it's costing us."
        />
        <DialogFooter>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || description.trim().length < 20}
          >
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
