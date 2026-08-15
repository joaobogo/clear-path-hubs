import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { proposalErrorMessage } from "@/lib/interview-proposal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  listClientInterviews,
  listSchedulableCandidates,
  requestInterview,
  proposeInterviewTimes,
  confirmInterviewTime,
  cancelInterview,
  markInterviewCompleted,
  type InterviewDTO,
} from "@/lib/interviews.functions";
import {
  proposeFromAvailability,
  rescheduleInterview,
} from "@/lib/availability.functions";
import {
  listInterviewsAwaitingFeedback,
  type FeedbackQueueItem,
} from "@/lib/interview-feedback.functions";
import {
  AvailabilityManager,
  useAvailability,
} from "@/components/client/scheduling/availability-manager";
import { InterviewTimeline } from "@/components/client/scheduling/interview-timeline";
import {
  InterviewFeedbackDialog,
  InterviewFeedbackQueue,
} from "@/components/client/interview-feedback-form";
import { useResolvedClientOrgId, useClientRole } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { PageHeader, PageBody, PageShell } from "@/components/ds";
import { EmptyState, SkeletonCards, ViewerReadOnlyNotice } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { Button } from "@/components/ui/button";
import { CalendarClock, Plus } from "lucide-react";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";
import { RequestInterviewDialog } from "@/components/client/interviews/request-interview-dialog";
import { InterviewDetailDialog } from "@/components/client/interviews/interview-detail-dialog";
import { detectTimezone } from "@/components/client/interviews/helpers";

const RoutePending = makeWorkspacePending({ shape: "cards", kpis: false, width: "6xl" });
export const Route = createFileRoute("/_authenticated/client/interviews")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.interviews.tsx"),
  notFoundComponent: makeRouteNotFoundComponent("client"),
  validateSearch: (search: Record<string, unknown>) => ({
    interview: typeof search.interview === "string" ? search.interview : undefined,
    feedback: typeof search.feedback === "string" ? search.feedback : undefined,
  }),
  head: () => ({
  meta: [
  { title: "Interviews · Client workspace" },
  { name: "robots", content: "noindex" },
  ],
  }),
  component: InterviewsPage,
});

function InterviewsPage() {
  const org = useResolvedClientOrgId();
  const support = useSupportView();
  const role = useClientRole();
  const isViewer = role === "client_viewer" || support.permissionPreview === "client_viewer";
  const readOnly = support.readOnly || isViewer;
  const qc = useQueryClient();
  const listFn = useServerFn(listClientInterviews);
  const candidatesFn = useServerFn(listSchedulableCandidates);
  const requestFn = useServerFn(requestInterview);
  const proposeFn = useServerFn(proposeInterviewTimes);
  const confirmFn = useServerFn(confirmInterviewTime);
  const cancelFn = useServerFn(cancelInterview);
  const completeFn = useServerFn(markInterviewCompleted);
  const autoProposeFn = useServerFn(proposeFromAvailability);
  const rescheduleFn = useServerFn(rescheduleInterview);
  const feedbackListFn = useServerFn(listInterviewsAwaitingFeedback);
  const search = useSearch({ from: "/_authenticated/client/interviews" });

  const [requestOpen, setRequestOpen] = useState(false);
  const [detail, setDetail] = useState<InterviewDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<FeedbackQueueItem | null>(null);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [requestFailed, setRequestFailed] = useState<string | null>(null);
  const [proposeFailed, setProposeFailed] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["client-interviews", org, "all"],
    queryFn: () => listFn({ data: { orgId: org!, status: "all" } }),
    enabled: !!org,
  });
  const feedbackListQuery = useQuery({
    queryKey: ["interviews-awaiting-feedback", org],
    queryFn: () => feedbackListFn({ data: { orgId: org! } }),
    enabled: !!org,
  });
  const availability = useAvailability(org);

  // The interviews desk also moves when a candidate match changes elsewhere.
  const live = useRouteRealtime({
    scope: "client-interviews",
    orgId: org ?? null,
    invalidateKeys: [["client-interviews"], ["client-schedulable", org], ["client-kpis"]],
  });
  const hasWindows = ((availability.data?.windows ?? []) as unknown[]).length > 0;
  // The client's stored timezone wins; the browser is only a fallback.
  const orgTimezone =
    (availability.data?.timezone as string | null | undefined) || detectTimezone();

  const interviews = (listQuery.data?.interviews as InterviewDTO[] | undefined) ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["client-interviews"] });
    qc.invalidateQueries({ queryKey: ["client-kpis"] });
    qc.invalidateQueries({ queryKey: ["client-candidates"] });
  };

  // A confirmation from the recruiting team updates the same card, no refresh.
  useEffect(() => {
    if (!org) return;
    const channel = supabase
      .channel(`client-interviews-${org}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "interviews",
          filter: `organization_id=eq.${org}`,
        },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  // Deep-link: ?interview=<id> opens that interview; ?feedback=1 also opens the
  // feedback form for it. We scroll the timeline item into view so the user
  // lands on the record, not the top of the list.
  useEffect(() => {
    const interviewId = search.interview as string | undefined;
    if (!interviewId || !listQuery.data) return;
    const iv = interviews.find((i) => i.id === interviewId);
    if (iv) {
      setDetail(iv);
      requestAnimationFrame(() => {
        const el = document.getElementById(`interview-${interviewId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary", "ring-offset-2"), 2000);
        }
      });
    }
    if (search.feedback && feedbackListQuery.data) {
      const items = (feedbackListQuery.data as FeedbackQueueItem[] | undefined) ?? [];
      const item = items.find((i) => i.interview_id === interviewId);
      if (item) setFeedbackFor(item);
    }
  }, [search.interview, search.feedback, listQuery.data, feedbackListQuery.data, interviews]);

  const requestMut = useMutation({
    mutationFn: (payload: Parameters<typeof requestFn>[0]["data"]) => requestFn({ data: payload }),
    onSuccess: () => {
      toast.success("Times proposed — we'll confirm with the candidate");
      setRequestFailed(null);
      setRequestOpen(false);
      invalidate();
    },
    onError: (e: Error) => setRequestFailed(proposalErrorMessage(e.message)),
  });

  const proposeMut = useMutation({
    mutationFn: (payload: Parameters<typeof proposeFn>[0]["data"]) => proposeFn({ data: payload }),
    onSuccess: () => {
      toast.success("Times proposed — awaiting confirmation");
      setProposeFailed(null);
      setProposingId(null);
      invalidate();
      setDetail(null);
    },
    onError: (e: Error) => setProposeFailed(proposalErrorMessage(e.message)),
  });

  const autoProposeMut = useMutation({
    mutationFn: (payload: { orgId: string; id: string }) => autoProposeFn({ data: payload }),
    onSettled: () => setBusyId(null),
    onSuccess: (res) => {
      toast.success(
        `Sent ${(res as { slots: string[] }).slots.length} times from your availability — the candidate picks one.`,
      );
      invalidate();
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "no_availability_windows"
          ? "Set your availability windows first."
          : e.message === "no_slots_available"
            ? "No open slots in the next 10 days — widen your windows."
            : e.message,
      ),
  });

  const rescheduleMut = useMutation({
    mutationFn: (payload: { orgId: string; id: string }) => rescheduleFn({ data: payload }),
    onSettled: () => setBusyId(null),
    onSuccess: (res) => {
      const r = res as { slots: string[]; hasWindows: boolean };
      toast.success(
        r.hasWindows
          ? `New times sent. Both you and the candidate have been notified.`
          : "Interview reopened for new times. Add availability to send options automatically.",
      );
      invalidate();
      setDetail(null);
    },
    onError: (e: Error) => toastError(e),
  });

  const confirmMut = useMutation({
    mutationFn: (payload: Parameters<typeof confirmFn>[0]["data"]) => confirmFn({ data: payload }),
    onSuccess: () => {
      toast.success("Interview scheduled");
      invalidate();
      setDetail(null);
    },
    onError: (e: Error) => {
      if (e.message === "scheduled_in_past") toast.error("Choose a future time.");
      else toastError(e);
    },
  });

  const cancelMut = useMutation({
    mutationFn: (payload: Parameters<typeof cancelFn>[0]["data"]) => cancelFn({ data: payload }),
    onSuccess: () => {
      toast.success("Interview cancelled");
      invalidate();
      setDetail(null);
    },
    onError: (e: Error) => toastError(e),
  });

  const completeMut = useMutation({
    mutationFn: (payload: Parameters<typeof completeFn>[0]["data"]) =>
      completeFn({ data: payload }),
    onSuccess: () => {
      toast.success("Interview marked completed");
      invalidate();
      setDetail(null);
    },
    onError: (e: Error) => toastError(e),
  });

  return (
    <PageShell>
      <PageHeader
        title="Interviews"
        description="Set your availability once — everything else happens on this one timeline."
        actions={
          <div className="flex items-center gap-2">
            <LiveUpdatedChip updatedAt={live.updatedAt} />
            {!readOnly ? (
              <Button onClick={() => setRequestOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Request interview
              </Button>
            ) : null}
          </div>
        }
      />
      <PageBody>
        {isViewer && !support.readOnly && (
          <ViewerReadOnlyNotice area="requesting and rescheduling interviews" />
        )}
        {org ? <InterviewFeedbackQueue orgId={org} readOnly={readOnly} /> : null}

        {org ? <AvailabilityManager orgId={org} readOnly={readOnly} /> : null}

        {listQuery.isLoading ? (
          <SkeletonCards cards={3} />
        ) : listQuery.isError ? (
          <QueryErrorCard
            title="We couldn't load your interviews"
            error={listQuery.error}
            onRetry={() => void listQuery.refetch()}
            retrying={listQuery.isFetching}
          />
        ) : interviews.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No interviews yet"
            description={
              readOnly
                ? "Interviews appear here as soon as your team schedules them."
                : "Set your availability windows above, then request an interview with a shortlisted candidate."
            }
            whatAppearsHere="Each interview shows the requested slots, who confirmed, and the scorecard once it's done."
            action={
              readOnly
                ? { label: "See your candidates", to: "/client/candidates" }
                : { label: "Request interview", onClick: () => setRequestOpen(true) }
            }
          />
        ) : (
          <InterviewTimeline
            interviews={interviews}
            readOnly={readOnly}
            hasWindows={hasWindows}
            busyId={busyId}
            onOpen={(iv) => setDetail(iv)}
            onProposeFromAvailability={(iv) => {
              setBusyId(iv.id);
              autoProposeMut.mutate({ orgId: iv.organization_id, id: iv.id });
            }}
            onReschedule={(iv) => {
              setBusyId(iv.id);
              rescheduleMut.mutate({ orgId: iv.organization_id, id: iv.id });
            }}
            timezone={orgTimezone}
            proposingId={proposingId}
            proposeSubmitting={proposeMut.isPending}
            proposeFailed={proposeFailed}
            onStartPropose={(iv) => {
              setProposeFailed(null);
              setProposingId(iv.id);
            }}
            onCancelPropose={() => {
              setProposingId(null);
              setProposeFailed(null);
            }}
            onSubmitPropose={(iv, p) =>
              proposeMut.mutate({
                orgId: iv.organization_id,
                id: iv.id,
                proposedTimes: p.slotsIso,
                interviewType: p.format,
                timezone: p.timezone,
                durationMinutes: p.durationMinutes,
                participants: p.attendees,
                ...(p.notes ? { notes: p.notes } : {}),
              })
            }
          />
        )}
      </PageBody>

      {requestOpen && org ? (
        <RequestInterviewDialog
          orgId={org}
          onClose={() => {
            setRequestOpen(false);
            setRequestFailed(null);
          }}
          submitting={requestMut.isPending}
          failed={requestFailed}
          timezone={orgTimezone}
          onSubmit={(payload) => requestMut.mutate(payload)}
          fetchCandidates={() => candidatesFn({ data: { orgId: org } })}
        />
      ) : null}

      {detail ? (
        <InterviewDetailDialog
          interview={detail}
          readOnly={readOnly}
          onClose={() => setDetail(null)}
          onPropose={(times) =>
            proposeMut.mutate({ orgId: detail.organization_id, id: detail.id, proposedTimes: times })
          }
          onConfirm={(payload) =>
            confirmMut.mutate({ orgId: detail.organization_id, id: detail.id, ...payload })
          }
          onCancel={(reason) =>
            cancelMut.mutate({ orgId: detail.organization_id, id: detail.id, reason })
          }
          onComplete={(feedback) =>
            completeMut.mutate({ orgId: detail.organization_id, id: detail.id, feedback })
          }
          onScorecard={() => {
            setFeedbackFor({
              interview_id: detail.id,
              candidate_match_id: detail.candidate_match_id,
              candidate_name: detail.candidate?.name ?? "Candidate",
              position_id: detail.position_id ?? null,
              position_title: detail.position?.title ?? "Your role",
              interview_type: detail.interview_type ?? null,
              happened_at: detail.completed_at ?? detail.scheduled_at ?? null,
              prompt_from: null,
              status: detail.status,
            });
            setDetail(null);
          }}
          pending={
            proposeMut.isPending ||
            confirmMut.isPending ||
            cancelMut.isPending ||
            completeMut.isPending
          }
        />
      ) : null}

      {org && feedbackFor ? (
        <InterviewFeedbackDialog
          orgId={org}
          item={feedbackFor}
          readOnly={readOnly}
          open
          onOpenChange={(v: boolean) => {
            if (!v) setFeedbackFor(null);
          }}
        />
      ) : null}
    </PageShell>
  );
}
