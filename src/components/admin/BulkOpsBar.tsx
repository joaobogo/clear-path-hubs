import { useState } from "react";
import { BULK_STAGES } from "@/lib/admin-bulk-constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BulkConfirmDialog,
  type PreviewInput,
} from "@/components/admin/bulk-confirm-dialog";
import { toast } from "sonner";

const STAGE_LABEL: Record<string, string> = {
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview_process: "Interviewing",
  offer: "Offer",
  not_moving_forward: "Not moving forward",
};

export function BulkOpsBar({
  matchIds,
  candidateProfileIds,
  positions,
  onDone,
}: {
  matchIds: string[];
  candidateProfileIds: string[];
  positions: Array<{ id: string; title: string }>;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<(typeof BULK_STAGES)[number]>("shortlisted");
  const [positionId, setPositionId] = useState<string>(positions[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [request, setRequest] = useState<PreviewInput | null>(null);

  // Empty selection: the bar stays hidden.
  if (matchIds.length === 0 && candidateProfileIds.length === 0) return null;

  const selected = matchIds.length || candidateProfileIds.length;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <span className="text-sm font-medium">
          {selected} selected
        </span>
        <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
          <SelectTrigger className="h-8 w-44" aria-label="Target stage">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BULK_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {STAGE_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={matchIds.length === 0}
          onClick={() =>
            setRequest({ kind: "candidate_stage", match_ids: matchIds, to_stage: stage })
          }
        >
          Preview stage move
        </Button>

        <Select value={positionId} onValueChange={setPositionId}>
          <SelectTrigger className="h-8 w-56" aria-label="Assign to role">
            <SelectValue placeholder="Assign to role…" />
          </SelectTrigger>
          <SelectContent>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={candidateProfileIds.length === 0}
          onClick={() => {
            if (!positionId) return toast.error("Pick a role first");
            setRequest({
              kind: "candidate_assign",
              candidate_profile_ids: candidateProfileIds,
              position_id: positionId,
            });
          }}
        >
          Preview assign
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={matchIds.length === 0}
          onClick={() => setMessageOpen(true)}
        >
          Send update
        </Button>
      </div>

      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update about {matchIds.length} candidate(s)</DialogTitle>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="What should the client team know?"
            aria-label="Update message"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMessageOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={message.trim().length < 5}
              onClick={() => {
                setMessageOpen(false);
                setRequest({
                  kind: "candidate_update_message",
                  match_ids: matchIds,
                  message: message.trim(),
                });
              }}
            >
              Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkConfirmDialog
        request={request}
        onClose={() => setRequest(null)}
        onCommitted={() => {
          setMessage("");
          onDone();
        }}
      />
    </>
  );
}
