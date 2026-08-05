import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCandidateTeamActivity,
  recordCandidateView,
} from "@/lib/candidate-team-activity.functions";
import {
  TEAM_ACTIVITY_PREVIEW,
  activityLine,
  formatActivityTime,
} from "@/lib/candidate-team-activity";

/**
 * "Your team" activity for one candidate.
 *
 * Only the client's own people appear, and only from recorded events: a
 * candidate opened, a comment added, feedback submitted, a decision recorded.
 * Nothing about how we or our recruiters worked the role is shown here.
 */
export function CandidateTeamActivity({
  orgId,
  matchId,
  recordView = false,
}: {
  orgId: string;
  matchId: string;
  /** Record that the current user opened this candidate. */
  recordView?: boolean;
}) {
  const listFn = useServerFn(getCandidateTeamActivity);
  const recordFn = useServerFn(recordCandidateView);
  const [expanded, setExpanded] = useState(false);

  const q = useQuery({
    queryKey: ["candidate-team-activity", orgId, matchId],
    queryFn: () => listFn({ data: { orgId, matchId } }),
    staleTime: 30_000,
  });

  // The view is recorded once per open; a failure here never affects the page.
  useEffect(() => {
    if (!recordView) return;
    let cancelled = false;
    recordFn({ data: { orgId, matchId } })
      .then((r) => {
        if (!cancelled && r?.recorded) q.refetch();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, matchId, recordView]);

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <section className="rounded-xl border bg-card p-4">
      <header className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Your team</h2>
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );

  if (q.isLoading) {
    return (
      <Frame>
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Frame>
    );
  }

  if (q.isError) {
    return (
      <Frame>
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>We couldn't load your team's activity. Nothing is missing from the record.</span>
        </div>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => q.refetch()}>
          Try again
        </Button>
      </Frame>
    );
  }

  const entries = q.data?.entries ?? [];
  if (entries.length === 0) {
    return (
      <Frame>
        <p className="text-sm text-muted-foreground">No activity from your team yet.</p>
      </Frame>
    );
  }

  const shown = expanded ? entries : entries.slice(0, TEAM_ACTIVITY_PREVIEW);

  return (
    <Frame>
      <ul className="space-y-2">
        {shown.map((e) => (
          <li key={e.id} className="text-sm">
            <span className="text-foreground">{activityLine(e)}</span>
            {e.detail && <span className="text-muted-foreground"> — {e.detail}</span>}
            <span className="block text-xs text-muted-foreground">{formatActivityTime(e.at)}</span>
          </li>
        ))}
      </ul>
      {entries.length > TEAM_ACTIVITY_PREVIEW && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3 px-0"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all ${entries.length}`}
        </Button>
      )}
    </Frame>
  );
}
