import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  listClientInterviews,
  type InterviewDTO,
} from "@/lib/interviews.functions";
import {
  listInterviewsAwaitingFeedback,
  type FeedbackQueueItem,
} from "@/lib/interview-feedback.functions";
import {
  InterviewFeedbackDialog,
  InterviewFeedbackQueue,
} from "@/components/client/interview-feedback-form";
import { useResolvedClientOrgId, useClientRole } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { PageHeader, PageBody, PageShell } from "@/components/ds";
import { EmptyState, SkeletonCards } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { InterviewHistoryList } from "@/components/client/interview-history-list";
import { CalendarClock } from "lucide-react";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";
import { kpiCacheKeys } from "@/lib/kpis/cache-keys";

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
  const listFn = useServerFn(listClientInterviews);
  const feedbackListFn = useServerFn(listInterviewsAwaitingFeedback);
  const search = useSearch({ from: "/_authenticated/client/interviews" });

  const [feedbackFor, setFeedbackFor] = useState<FeedbackQueueItem | null>(null);

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

  const live = useRouteRealtime({
    scope: "client-interviews",
    orgId: org ?? null,
    invalidateKeys: [
      kpiCacheKeys.client.interviews(org),
      kpiCacheKeys.client.kpis,
      kpiCacheKeys.client.overview(org),
      kpiCacheKeys.client.candidates(org),
    ],
  });

  const interviews = (listQuery.data?.interviews as InterviewDTO[] | undefined) ?? [];

  // Deep-link: ?feedback=1 with ?interview=<id> opens the feedback form.
  useEffect(() => {
    const interviewId = search.interview as string | undefined;
    if (!interviewId || !search.feedback || !feedbackListQuery.data) return;
    const items = (feedbackListQuery.data as FeedbackQueueItem[] | undefined) ?? [];
    const item = items.find((i) => i.interview_id === interviewId);
    if (item) setFeedbackFor(item);
  }, [search.interview, search.feedback, feedbackListQuery.data]);

  return (
    <PageShell>
      <PageHeader
        title="Interviews"
        description="Arrange interviews directly with the candidate, outside TaaSFlow. Past interviews and their feedback are kept here."
        actions={<LiveUpdatedChip updatedAt={live.updatedAt} />}
      />
      <PageBody>
        {org ? (
          <InterviewFeedbackQueue
            orgId={org}
            readOnly={readOnly}
            onOpenFeedback={(item) => setFeedbackFor(item)}
          />
        ) : null}

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
            title="No interviews on record"
            description="Arrange interviews directly with the candidate, outside TaaSFlow."
            whatAppearsHere="Interviews recorded earlier, and the feedback left on them, appear here."
            action={{ label: "See your candidates", to: "/client/candidates" }}
          />
        ) : (
          <InterviewHistoryList
            interviews={interviews}
            readOnly={readOnly}
            onFeedback={(item) => setFeedbackFor(item)}
          />
        )}
      </PageBody>

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
