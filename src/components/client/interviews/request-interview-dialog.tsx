import { useState } from "react";
import { formatEnumLabel } from "@/lib/human-labels";
import { useQuery } from "@tanstack/react-query";
import { SlotProposer } from "@/components/client/scheduling/slot-proposer";
import { QueryErrorCard } from "@/components/client/query-error";
import { useStaleServerError } from "@/lib/use-live-errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  InterviewParticipant,
  InterviewType,
  SchedulableCandidate,
} from "@/lib/interviews.functions";

export function RequestInterviewDialog({
  orgId,
  onClose,
  onSubmit,
  submitting,
  failed,
  fetchCandidates,
  timezone,
  initialMatchId,
}: {
  orgId: string;
  onClose: () => void;
  onSubmit: (payload: {
    orgId: string;
    matchId: string;
    interviewType: InterviewType;
    timezone: string;
    durationMinutes: number;
    proposedTimes: string[];
    participants: InterviewParticipant[];
    notes?: string;
  }) => void;
  submitting: boolean;
  failed: string | null;
  fetchCandidates: () => Promise<{ candidates: SchedulableCandidate[] }>;
  timezone: string;
  initialMatchId?: string;
}) {
  const candidatesQ = useQuery({
    queryKey: ["client-schedulable", orgId],
    queryFn: fetchCandidates,
  });
  const [matchId, setMatchId] = useState<string>(initialMatchId ?? "");
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const candidates = candidatesQ.data?.candidates ?? [];
  // A candidate-specific refusal stops applying once another candidate is picked.
  const liveFailed = useStaleServerError(failed, matchId);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Propose interview times</DialogTitle>
          <DialogDescription>
            Offer times and say who joins. We confirm one with the candidate — no
            back-and-forth from your inbox.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="request-candidate" className="text-sm font-medium">
              Candidate
            </label>
            {candidatesQ.isError ? (
              <QueryErrorCard
                title="We couldn't load your candidates"
                error={candidatesQ.error}
                onRetry={() => candidatesQ.refetch()}
                retrying={candidatesQ.isFetching}
                compact
                className="mt-1"
              />
            ) : (
              <Select
                value={matchId}
                onValueChange={(v) => {
                  setMatchId(v);
                  setCandidateError(null);
                }}
                disabled={submitting}
              >
                <SelectTrigger id="request-candidate" className="mt-1">
                  <SelectValue placeholder="Select a candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidatesQ.isLoading ? (
                    <div className="p-3 text-sm text-muted-foreground">Loading candidates…</div>
                  ) : candidates.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">
                      No delivered candidates available.
                    </div>
                  ) : (
                    candidates.map((c) => {
                      const isInterviewable = ["delivered", "shortlisted", "interview_process"].includes(c.stage);
                      const isDisabled = c.has_active_interview || !isInterviewable;
                      return (
                        <SelectItem
                          key={c.match_id}
                          value={c.match_id}
                          disabled={isDisabled}
                        >
                          {c.candidate_name} — {c.position_title}
                          {c.has_active_interview ? " · (has active interview)" : ""}
                          {!isInterviewable ? ` · (${formatEnumLabel(c.stage)})` : ""}
                        </SelectItem>
                      );
                    })

                  )}
                </SelectContent>
              </Select>
            )}
            {candidateError ? (
              <p className="mt-1 text-xs text-destructive">{candidateError}</p>
            ) : null}
          </div>

          <SlotProposer
            timezone={timezone}
            candidatePreference={
              candidates.find((c) => c.match_id === matchId)?.availability_preference ?? null
            }
            submitting={submitting}
            failed={liveFailed}
            onCancel={onClose}
            submitLabel="Send proposed times"
            onSubmit={(p) => {
              if (!matchId) {
                setCandidateError("Choose a candidate first.");
                return;
              }
              onSubmit({
                orgId,
                matchId,
                interviewType: p.format,
                timezone: p.timezone,
                durationMinutes: p.durationMinutes,
                proposedTimes: p.slotsIso,
                participants: p.attendees,
                ...(p.notes ? { notes: p.notes } : {}),
              });
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
