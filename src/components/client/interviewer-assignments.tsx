import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ShieldCheck, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignInterviewerToCandidate,
  getCandidateInterviewerAssignments,
  revokeInterviewerAssignment,
} from "@/lib/interviewer-assignments.functions";
import { assignmentStatusLine } from "@/lib/interviewer-assignments";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Interviewer access for ONE candidate.
 *
 * An assignment is the only way an Interviewer can open a candidate: they get
 * this candidate and nothing else, for this stage, and access ends by itself
 * when their feedback is submitted or the candidate is declined. Every
 * assignment on this candidate is listed with who granted it.
 */
export function InterviewerAssignments({
  orgId,
  matchId,
  readOnly = false,
}: {
  orgId: string;
  matchId: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(getCandidateInterviewerAssignments);
  const assignFn = useServerFn(assignInterviewerToCandidate);
  const revokeFn = useServerFn(revokeInterviewerAssignment);

  const [selected, setSelected] = useState<string>("");
  const [failure, setFailure] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["interviewer-assignments", orgId, matchId],
    queryFn: () => listFn({ data: { orgId, matchId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["interviewer-assignments", orgId, matchId] });
  };

  const assign = useMutation({
    mutationFn: (interviewerUserId: string) =>
      assignFn({ data: { orgId, matchId, interviewerUserId } }),
    onSuccess: () => {
      setSelected("");
      setFailure(null);
      invalidate();
    },
    // Nothing is granted on failure — we say exactly why.
    onError: (e: Error) =>
      setFailure(e.message.replace(/^Error: /, "") || "We couldn't grant that access."),
  });

  const revoke = useMutation({
    mutationFn: (assignmentId: string) => revokeFn({ data: { orgId, assignmentId } }),
    onSuccess: () => {
      setFailure(null);
      invalidate();
    },
    onError: (e: Error) =>
      setFailure(e.message.replace(/^Error: /, "") || "We couldn't end that access."),
  });

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <section className="rounded-xl border bg-card p-4">
      <header className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Interviewer access</h2>
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );

  if (q.isLoading) {
    return (
      <Frame>
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-9 w-full" />
        </div>
      </Frame>
    );
  }

  if (q.isError) {
    return (
      <Frame>
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            We couldn't load who has access. Nothing has changed — nobody was granted or removed.
          </span>
        </div>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => q.refetch()}>
          Try again
        </Button>
      </Frame>
    );
  }

  const data = q.data;
  if (!data) return null;

  const unassigned = data.interviewers.filter((i) => !i.assigned);
  const active = data.assignments.filter((a) => !a.endedAt);
  const ended = data.assignments.filter((a) => a.endedAt);

  return (
    <Frame>
      {failure && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{failure}</span>
        </div>
      )}

      {data.assignments.length === 0 && data.interviewers.length === 0 ? (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>No interviewers on your team yet.</p>
          <p>
            Add someone with the Interviewer role and they'll be able to open just the candidates
            you assign them.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-1">
            <Link to="/client/account" search={{ tab: "team" }}>Invite an interviewer</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <ul className="space-y-2">
              {active.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{a.interviewerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {assignmentStatusLine(a)}
                      {a.stageLabel ? ` Stage: ${a.stageLabel}.` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Granted by {a.grantedByName} on {formatDay(a.grantedAt)}
                    </p>
                  </div>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-9"
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(a.id)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> End access
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {ended.length > 0 && (
            <ul className="space-y-1.5 border-t pt-3">
              {ended.map((a) => (
                <li key={a.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{a.interviewerName}</span>{" "}
                  {assignmentStatusLine(a).toLowerCase()} Granted by {a.grantedByName} on{" "}
                  {formatDay(a.grantedAt)}; ended {formatDay(a.endedAt!)}.
                </li>
              ))}
            </ul>
          )}

          {!readOnly && (
            <div className="border-t pt-3">
              {data.blockedReason ? (
                <p className="text-xs text-muted-foreground">{data.blockedReason}</p>
              ) : unassigned.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Every interviewer on your team already has access to this candidate.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={selected} onValueChange={setSelected}>
                    <SelectTrigger className="h-10 w-full sm:w-64" aria-label="Choose an interviewer">
                      <SelectValue placeholder="Add an interviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassigned.map((i) => (
                        <SelectItem key={i.userId} value={i.userId}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="min-h-10"
                    disabled={!selected || assign.isPending}
                    onClick={() => selected && assign.mutate(selected)}
                  >
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    Grant access
                  </Button>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                They'll see this candidate only — not the rest of your pipeline, and no contact
                details unless those have been released.
              </p>
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}
