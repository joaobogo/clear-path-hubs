import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { invalidateTalentMemory } from "@/lib/talent-memory/invalidate";
import { toastError } from "@/lib/toast-error";
import { Award, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REASON_LABELS,
  tagSilverMedalist,
  getMemoryByMatch,
  type SilverReason,
} from "@/lib/talent-memory.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  matchId: string;
  candidateName: string;
  roleTitle?: string | null;
};

export function TagSilverMedalistDialog({
  open,
  onOpenChange,
  orgId,
  matchId,
  candidateName,
  roleTitle,
}: Props) {
  const qc = useQueryClient();
  const tag = useServerFn(tagSilverMedalist);
  const [reason, setReason] = useState<SilverReason>("better_fit_selected");
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      tag({
        data: {
          orgId,
          matchId,
          reason_category: reason,
          reason_notes: notes || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Added to talent memory");
      invalidateTalentMemory(qc, matchId);
      onOpenChange(false);
    },
    onError: (e: Error) => toastError(e),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-4 w-4 text-warning-strong" aria-hidden />
            Add to talent memory
          </DialogTitle>
          <DialogDescription>
            Keep {candidateName} accessible after this search closes. You can
            resurface them for future roles that match their profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {roleTitle && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Tagged from role{" "}
              <span className="font-medium text-foreground">{roleTitle}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Why weren&apos;t they selected?</label>
            <Select value={reason} onValueChange={(v) => setReason(v as SilverReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(REASON_LABELS) as SilverReason[]).map((k) => (
                  <SelectItem key={k} value={k}>{REASON_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Context you'd want when revisiting them (e.g. strong in Python + ML, timing conflict Q3)."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* The consent picker was removed from the client dialog: a client
              adding someone to their own pool is not the person who holds the
              candidate's stated preference, so asking them to record it put a
              guess on file. The field still exists on the record and is still
              set by the server default. */}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {mut.isPending ? "Saving…" : "Add to memory"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SilverMedalistBadge({
  orgId,
  matchId,
}: {
  orgId: string;
  matchId: string;
}) {
  const fn = useServerFn(getMemoryByMatch);
  const { data } = useQuery({
    queryKey: ["memory-by-match", matchId],
    queryFn: () => fn({ data: { orgId, matchId } }),
  });
  if (!data) return null;
  // The badge states the tag's real status, so it can never claim an active
  // silver medalist while /client/talent-memory lists the entry as archived.
  const archived = data.status === "archived";
  return (
    <Badge
      className={
        archived
          ? "gap-1 border-border bg-muted text-muted-foreground"
          : "gap-1 border-warning/60 bg-warning/60 text-warning-strong"
      }
    >
      <Award className="h-3 w-3" aria-hidden />
      {archived ? "Previously shortlisted · archived" : "Previously shortlisted"}
    </Badge>
  );
}
