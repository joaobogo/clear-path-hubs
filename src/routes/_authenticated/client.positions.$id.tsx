import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { getClientContext } from "@/lib/client-context.functions";
import { type MatchStage } from "@/lib/client-match-stage";
import {
  TIMEZONE_BAND_LABELS,
  SPONSORSHIP_LABELS,
} from "@/lib/express-intake-schema";
import { useStageMove } from "@/lib/client/use-stage-move";
import { DeclineReasonDialog } from "@/components/client/decline-reason-dialog";

import { confirmRoleBlueprint } from "@/lib/client-positions.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { AlertCircle } from "lucide-react";
import { RoleMessagesPanel } from "@/components/client/role-messages-panel";


import { InfoRequestList } from "@/components/client/info-requests";
import { RoleClosureRecord } from "@/components/client/close-role-dialog";
import { RoleRecapPanel } from "@/components/client/role-recap";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";

import { PositionDetailPending } from "@/components/client/position-detail/pending";
import { QueryErrorCard } from "@/components/client/query-error";
import { ViewerReadOnlyNotice } from "@/components/client/states";
import { STAGE_GRAPH } from "@/components/client/position-detail/constants";
import { SummaryTile } from "@/components/client/position-detail/summary-tile";
import { PositionHeader } from "@/components/client/position-detail/header";
import { PositionHandoffView } from "@/components/client/position-detail/handoff-view";
import { RoleStatusSection } from "@/components/client/position-detail/role-status-section";
import { EvidencePanels } from "@/components/client/position-detail/evidence-panels";
import { RoleStoryPanel } from "@/components/client/position-detail/role-story";
import { useDetailCrumb } from "@/lib/workspace/crumb-label";
import { positionDetailQuery } from "@/lib/client-position-detail-query";


export const Route = createFileRoute("/_authenticated/client/positions/$id")({
  head: () => ({
    meta: [
      { title: "Role · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Prefetch the primary payload before first paint. The workspace context is
  // already in cache from the /client layout loader, so this is one request.
  loader: async ({ context, params, location }) => {
    const org = (location.search as { org?: string } | undefined)?.org ?? null;
    const ctx = await context.queryClient.ensureQueryData({
      queryKey: ["client-context", org],
      queryFn: () => getClientContext({ data: org ? { orgId: org } : {} }),
    });
    const orgId = (ctx as { active?: { organization_id?: string } } | null)?.active
      ?.organization_id;
    if (!orgId) return;
    await context.queryClient.ensureQueryData(positionDetailQuery(orgId, params.id));
  },
  // Fast navigations never flash a skeleton; slow ones get the real layout.
  pendingMs: 150,
  pendingComponent: PositionDetailPending,
  notFoundComponent: () => <div className="p-8">Role not found.</div>,
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.positions.$id.tsx"),
  component: PositionDetailPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function PositionDetailPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  // A failed workspace lookup must say so rather than skeleton forever.
  if (ctxQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <QueryErrorCard
          title="We couldn't load this role"
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
        />
      </div>
    );
  }
  const orgId = ctx?.active?.organization_id;
  // No resolved workspace means no role to show; the layout already redirects
  // callers with no membership, so this is only the brief pre-resolve window.
  if (!orgId) return <PositionDetailPending />;
  return <PositionDetailView orgId={orgId} ctx={ctx} />;
}

function PositionDetailView({ orgId, ctx }: { orgId: string; ctx: AnyRow }) {
  const { id } = Route.useParams();
  const orgSearchParam = useClientOrgSearch();
  const qc = useQueryClient();
  const support = useSupportView();
  const queryKey = ["client-position", orgId, id];
  // One request for the primary payload: role, pipeline, timeline, lifecycle,
  // closure, recap and open information requests.
  const { data, refetch } = useSuspenseQuery(positionDetailQuery(orgId, id));
  const handoff = data?.handoff ?? null;
  const closure = data?.closure ?? null;
  const recap = data?.recap ?? null;
  const infoRequests = data?.info_requests ?? [];
  useEffect(() => {
    const onRefresh = () => {
      void refetch();
    };
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  // This role is a shared surface. When a candidate on it moves elsewhere, the
  // board refreshes itself and says so instead of reshuffling under the cursor.
  const live = useRouteRealtime({
    scope: "client-position",
    orgId,
    positionId: id,
    invalidateKeys: [queryKey, ["client-overview", orgId], ["client-positions", orgId]],
  });

  const [declining, setDeclining] = useState<{ matchId: string; name: string | null } | null>(null);

  const confirmBlueprintFn = useServerFn(confirmRoleBlueprint);
  const confirmBlueprint = useMutation({
    mutationFn: () => confirmBlueprintFn({ data: { orgId: orgId!, positionId: id } }),
    onSuccess: () => {
      toast.success("Thanks — we've noted your sign-off on this brief.");
      void refetch();
    },
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't record that. Please try again." }),
  });

  // The one client-side stage-move path, shared with the Candidates board.
  const move = useStageMove({
    orgId,
    queryKey,
    getMatches: (cached: AnyRow) => (cached?.matches as AnyRow[] | undefined) ?? [],
    refetch,
    invalidateKeys: [
      ["client-overview", orgId],
      ["client-positions", orgId],
      ["client-candidates", orgId],
    ],
  });

  // Published before any early return / throw so hook order stays stable.
  useDetailCrumb((data as { position?: { title?: string } } | undefined)?.position?.title);

  // Load failures raise to the route errorComponent; a missing role is a 404.
  if (!data) throw notFound();
  if (!data.position) throw notFound();

  const canEdit =
    !support.readOnly &&
    (ctx?.active?.role === "client_admin" ||
      ctx?.active?.role === "client_editor" ||
      ctx?.active?.role === "platform_admin" ||
      ctx?.active?.role === "operations");

  const { position, matches, activity, summary } = data;

  // ── Handoff after a hire ────────────────────────────────────────────────────
  // With a confirmed hire on the role, the search view is replaced by what
  // remains: agreed terms, the derived guarantee window, and the outstanding
  // steps. The role stays reachable — messages and history remain open.
  if (handoff && data.summary.client_status.key === "closed") {
    return (
      <PositionHandoffView
        position={position}
        orgId={orgId}
        positionId={id}
        canEdit={canEdit}
        story={data.story ?? null}
        org={orgSearchParam}
      />
    );
  }

  const attemptMove = (matchId: string, from: MatchStage, to: MatchStage) => {
    if (from === to) return;
    const allowed = STAGE_GRAPH[from] ?? [];
    if (!allowed.includes(to)) {
      toast.error(
        `Cannot move from ${from.replace("_", " ")} to ${to.replace("_", " ")}.`,
      );
      return;
    }
    if (to === "not_moving_forward") {
      // A decline is a real answer to a person: it always carries a structured
      // reason from the shared catalogue, never a free-text prompt.
      const m = (matches as AnyRow[]).find((r) => r.id === matchId);
      setDeclining({ matchId, name: (m?.candidate_name as string) ?? null });
      return;
    }

    move.mutate({ matchId, toStage: to });
  };

  /**
   * Placement and authorisation, read back from what the client actually stated
   * at intake. Nothing is inferred: a missing answer simply does not show.
   */
  const placementLine = (() => {
    const ictx = (position.intake_context ?? {}) as Record<string, unknown>;
    const auth = (position.work_authorization ?? {}) as Record<string, unknown>;
    const parts: string[] = [];
    const days = Number(ictx.onsite_days ?? 0);
    if (position.work_model === "hybrid" && days > 0) {
      parts.push(`${days} day${days === 1 ? "" : "s"} on site each week`);
    }
    if (position.work_model === "remote") {
      if (ictx.remote_anywhere_in_country === true) parts.push("Anywhere in the country");
      const tz = Array.isArray(ictx.remote_timezones) ? (ictx.remote_timezones as string[]) : [];
      if (tz.length > 0) {
        parts.push(`Timezones: ${tz.map((t) => TIMEZONE_BAND_LABELS[t] ?? t).join(", ")}`);
      }
    }
    const sponsorship =
      typeof auth.sponsorship_available === "boolean"
        ? auth.sponsorship_available
        : typeof ictx.sponsorship_available === "string"
          ? ictx.sponsorship_available === "yes"
          : null;
    if (sponsorship !== null) {
      parts.push(SPONSORSHIP_LABELS[sponsorship ? "yes" : "no"]);
    }
    return parts.join(" · ");
  })();

  const actionRequired: Array<{ label: string; href?: string; search?: Record<string, string> }> = [];
  if (summary.delivered > 0) {
    actionRequired.push({
      label: `${summary.delivered} new candidate${summary.delivered === 1 ? "" : "s"} to review`,
      href: "/client/candidates",
      search: { position: id, stage: "delivered" },
    });
  }
  if (summary.interviews_to_confirm > 0) {
    actionRequired.push({
      label: `${summary.interviews_to_confirm} interview${summary.interviews_to_confirm === 1 ? "" : "s"} to confirm`,
      href: "/client/interviews",
    });
  }
  if (summary.interview_scheduled > 0) {
    actionRequired.push({
      label: `${summary.interview_scheduled} interview${summary.interview_scheduled === 1 ? "" : "s"} scheduled`,
      href: "/client/interviews",
    });
  }
  if (summary.offers > 0) {
    actionRequired.push({
      label: `${summary.offers} offer${summary.offers === 1 ? "" : "s"} awaiting response`,
      href: "/client/offers",
    });
  }
  if (position.status === "needs_clarification") {
    actionRequired.push({
      label: "TaaSFlow needs clarification from your team",
      href: `/client/positions/${id}`,
      search: { tab: "brief" },
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/client/positions"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All positions
        </Link>
        <LiveUpdatedChip updatedAt={live.updatedAt} />
      </div>

      {!canEdit && !support.readOnly ? (
        <ViewerReadOnlyNotice area="editing this role and deciding on candidates" />
      ) : null}

      {/* Recorded closure — reason, note, date and who closed it. */}
      {closure && <RoleClosureRecord closure={closure} />}

      {/* One-screen recap of the finished search. */}
      {closure && !closure.paused && recap && <RoleRecapPanel recap={recap} />}

      {/* 1. Header */}
      <PositionHeader
        position={position}
        orgId={orgId}
        canEdit={canEdit}
        supportReadOnly={support.readOnly}
        clientStatus={data?.summary?.client_status}
      />

      <div id="information-needed" className="scroll-mt-24">
        <InfoRequestList
          requests={infoRequests}
          heading="Information needed to keep sourcing"
          onAnswered={() => {
            void refetch();
            qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
          }}
        />
      </div>

      <RoleStatusSection
        progress={data.progress}
        pipelineLine={summary.pipeline_line}
      />

      {/* 2. Hiring summary */}
      <section aria-label="Hiring summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          label="Openings"
          value={summary.openings}
          hint={summary.openings > 1 ? "Multiple hires expected" : "Single hire"}
        />
        <SummaryTile
          label="Hired"
          value={summary.hires}
          hint={`${summary.remaining} remaining`}
        />
        <SummaryTile
          label="In progress"
          value={
            summary.delivered +
            summary.shortlisted +
            summary.interviewing +
            summary.offers
          }
          hint="Delivered · shortlisted · interviewing · offers"
        />
        <SummaryTile
          label="Delivered total"
          value={matches.length}
          hint="Client-visible candidates only"
        />
      </section>

      {/* 3. Action Required */}
      {actionRequired.length > 0 && (
        <section
          aria-label="Action required"
          className="rounded-xl border taas-bd-warning taas-bg-warning-soft p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 taas-fg-warning " />
            <h2 className="text-sm font-semibold">Action required</h2>
          </div>
          <ul className="space-y-1.5 text-sm">
            {actionRequired.map((a, i) => (
              <li key={i} className="text-foreground/90">
                • {a.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Role blueprint — the source of truth for this role, and where it is edited */}
      <EvidencePanels
        orgId={orgId}
        positionId={id}
        position={position}
        activity={activity}
        onConfirmBlueprint={() => confirmBlueprint.mutate()}
        confirmingBlueprint={confirmBlueprint.isPending}
      />

      {/* Requirement coverage — collapsed by default to keep this page readable */}
      {data.story && (
        <RoleStoryPanel story={data.story} positionId={id} org={orgSearchParam} hideCoverage />
      )}


      {/* 9. Messages — one thread per role */}
      {orgId && (
        <RoleMessagesPanel
          orgId={orgId}
          positionId={position.id}
          positionTitle={position.title as string | undefined}
          canPost={canEdit}
        />
      )}


      <DeclineReasonDialog
        open={!!declining}
        onOpenChange={(v) => !v && setDeclining(null)}
        candidateName={declining?.name ?? null}
        pending={move.isPending}
        onConfirm={({ reasonCode, note }) => {
          if (!declining) return;
          move.mutate({
            matchId: declining.matchId,
            toStage: "not_moving_forward",
            reasonCode,
            reason: note || undefined,
          });
          setDeclining(null);
        }}
      />
    </div>
  );
}
