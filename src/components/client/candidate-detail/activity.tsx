import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award, CalendarClock, ClipboardCheck, FileClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JourneyTimeline } from "@/components/candidate/journey-timeline";
import {
  InterviewFeedbackForm,
  SubmittedFeedbackList,
} from "@/components/client/interview-feedback-form";
import {
  getMatchFeedback,
  type FeedbackQueueItem,
} from "@/lib/interview-feedback.functions";
import { QueryErrorCard } from "@/components/client/query-error";
import { getCandidateJourney } from "@/lib/journey.functions";
import { reasonLabel } from "@/lib/client-decision-reasons";
import {
  TagSilverMedalistDialog,
  SilverMedalistBadge,
} from "@/components/client/tag-silver-medalist-dialog";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import { SectionCard } from "./shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

// Plain-English names for recorded decisions.
export const DECISION_LABELS: Record<string, string> = {
  shortlist: "Shortlisted",
  request_interview: "Interview requested",
  request_information: "More information requested",
  hold: "Placed on hold",
  request_contact_release: "Contact details requested",
  feedback: "Feedback added",
  not_moving_forward: "Declined for this role",
  offer: "Offer extended",
  hire: "Hired",
};

export function InterviewFeedbackSection({
  orgId,
  matchId,
  readOnly,
}: {
  orgId: string;
  matchId: string;
  readOnly: boolean;
}) {
  const fetchFn = useServerFn(getMatchFeedback);
  const query = useQuery({
    queryKey: ["match-feedback", orgId, matchId],
    queryFn: () => fetchFn({ data: { orgId, matchId } }),
    enabled: !!orgId && !!matchId,
  });

  if (query.isLoading) {
    return (
      <SectionCard title="Interview feedback" icon={<ClipboardCheck className="h-4 w-4" />}>
        <div className="space-y-2">
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded bg-muted" />
          <div className="h-9 w-32 animate-pulse rounded bg-muted" />
        </div>
      </SectionCard>
    );
  }

  if (query.isError) {
    return (
      <SectionCard title="Interview feedback" icon={<ClipboardCheck className="h-4 w-4" />}>
        <QueryErrorCard
          compact
          title="We couldn't load interview feedback"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </SectionCard>
    );
  }

  const pending = query.data?.pending ?? [];
  const submitted = query.data?.submitted ?? [];

  return (
    <SectionCard title="Interview feedback" icon={<ClipboardCheck className="h-4 w-4" />}>
      {pending.length === 0 && submitted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No interviews to review.</p>
      ) : null}
      {pending.length > 0 ? (
        <div className="space-y-4">
          {pending.map((item: FeedbackQueueItem) => (
            <InterviewFeedbackForm
              key={item.interview_id}
              orgId={orgId}
              item={item}
              readOnly={readOnly}
            />
          ))}
        </div>
      ) : null}
      {submitted.length > 0 ? (
        <div className={pending.length > 0 ? "mt-5" : ""}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Feedback given
          </h3>
          <SubmittedFeedbackList rows={submitted} />
        </div>
      ) : null}
    </SectionCard>
  );
}

export function ActivitySection({
  interviews,
  decisions,
}: {
  interviews: AnyRow[];
  decisions: AnyRow[];
}) {
  return (
    <SectionCard title="Activity" icon={<CalendarClock className="h-4 w-4" />}>
      {interviews.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Interviews
          </h3>
          <ul className="space-y-1 text-sm">
            {interviews.map((iv) => (
              <li key={iv.id} className="flex items-center justify-between">
                <span className="capitalize">{String(iv.status).replace(/_/g, " ")}</span>
                <span className="text-xs text-muted-foreground">
                  {iv.scheduled_at ?? iv.requested_at ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {decisions.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your team&apos;s decisions and feedback
          </h3>
          <ul className="space-y-2 text-sm">
            {decisions.map((d) => (
              <li key={d.id} className="border-b pb-2 last:border-b-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{DECISION_LABELS[String(d.decision)] ?? String(d.decision).replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </div>
                {d.reason_code && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Reason: {reasonLabel(String(d.reason_code))}
                  </div>
                )}
                {Array.isArray(d.details?.signals) && d.details.signals.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(d.details.signals as string[]).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {s.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                )}
                {d.feedback && (
                  <div className="mt-1 text-muted-foreground">{d.feedback}</div>
                )}
              </li>

            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

export function AuditTrailSection({ candidate }: { candidate: ClientCandidateDTO }) {
  const rows = candidate.audit_trail;
  if (rows.length === 0) return null;
  return (
    <SectionCard
      title="Audit trail"
      icon={<FileClock className="h-4 w-4" />}
      description="Timeline of candidate status and actions."
    >
      <ol className="relative ml-2 space-y-6 border-l-2 border-muted pl-4">
        {rows.map((e) => (
          <li key={e.id} className="relative">
            <div className="absolute -left-[1.35rem] mt-1.5 h-2 w-2 rounded-full border border-background bg-muted-foreground/40" />
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none text-foreground">
                {e.action}
              </span>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{new Date(e.at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

export function TalentMemoryAction({
  orgId,
  matchId,
  candidateName,
  roleTitle,
  readOnly,
}: {
  orgId: string;
  matchId: string;
  candidateName: string;
  roleTitle: string | null;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.08em]">
          <Award className="h-4 w-4 text-warning-strong" aria-hidden />
          Talent memory
        </h2>
        <SilverMedalistBadge orgId={orgId} matchId={matchId} />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Keep this candidate accessible for future roles, even after this search closes.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={readOnly}
        onClick={() => setOpen(true)}
      >
        Tag as silver medalist
      </Button>
      <TagSilverMedalistDialog
        open={open}
        onOpenChange={setOpen}
        orgId={orgId}
        matchId={matchId}
        candidateName={candidateName}
        roleTitle={roleTitle}
      />
    </div>
  );
}

export function JourneySection({ matchId }: { matchId: string }) {
  const query = useQuery({
    queryKey: ["candidate-journey", matchId],
    queryFn: () => getCandidateJourney({ data: { candidateMatchId: matchId } }),
  });
  // A failed timeline load says so — it never silently reads as "no history".
  if (query.isError) {
    return (
      <SectionCard title="Journey timeline" icon={<FileClock className="h-4 w-4" />}>
        <QueryErrorCard
          compact
          title="We couldn't load the journey timeline"
          error={query.error}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </SectionCard>
    );
  }
  if (query.isPending) return null;
  const events = query.data?.events ?? [];
  if (events.length === 0) return null;
  return (
    <SectionCard title="Journey timeline" icon={<FileClock className="h-4 w-4" />}>
      <JourneyTimeline events={events} />
    </SectionCard>
  );
}
