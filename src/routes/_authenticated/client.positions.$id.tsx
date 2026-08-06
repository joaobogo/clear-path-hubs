import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getClientContext } from "@/lib/client-context.functions";
import { getClientPositionDetail } from "@/lib/client-positions.functions";
import { moveMatchStage } from "@/lib/client-decisions.functions";
import { type MatchStage } from "@/lib/client-match-stage";
import {
  TIMEZONE_BAND_LABELS,
  SPONSORSHIP_LABELS,
} from "@/lib/express-intake-schema";
import { readAdvanceGateError } from "@/lib/client/advance-gate";
import { DeclineReasonDialog } from "@/components/client/decline-reason-dialog";

import { confirmRoleBlueprint } from "@/lib/client-positions.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { useSupportView } from "@/lib/support-view";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertCircle } from "lucide-react";
import { RoleBlueprint } from "@/components/product/role-blueprint";
import { GeneratedBlueprintPanel } from "@/components/positions/generated-blueprint-panel";
import { RoleLaunchPanel } from "@/components/positions/role-launch-panel";
import type { RoleLaunchState } from "@/lib/role-launch";
import { PreviouslyConsidered } from "@/components/client/previously-considered";
import { RoleMessagesPanel } from "@/components/client/role-messages-panel";
import { RoleMemoryPanel } from "@/components/role-memory-panel";

import { RoleProgressTracker } from "@/components/client/role-progress-tracker";
import { RoleDatedTimeline } from "@/components/client/role-dated-timeline";
import { DeliveryCommitmentBlock } from "@/components/client/delivery-commitment";
import { InfoRequestList } from "@/components/client/info-requests";
import { buildDeliveryCommitment } from "@/lib/delivery-commitment";
import { RoleShortlist } from "@/components/client/role-shortlist";
import { RoleLifecycleTimeline } from "@/components/client/role-lifecycle-timeline";
import { SlaScorecard } from "@/components/client/sla-scorecard";
import { HireHandoffPanel as _unused } from "@/components/client/hire-handoff";
import { CloseRoleDialog, RoleClosureRecord } from "@/components/client/close-role-dialog";
import { RoleRecapPanel } from "@/components/client/role-recap";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";
import { readStaleStateError } from "@/lib/decision-concurrency";

import { PositionDetailPending } from "@/components/client/position-detail/pending";
import { KANBAN_COLUMNS, STAGE_GRAPH, STAGE_LABELS } from "@/components/client/position-detail/constants";
import { SummaryTile } from "@/components/client/position-detail/summary-tile";
import { PipelineBoard } from "@/components/client/position-detail/pipeline-board";
import { PositionHeader } from "@/components/client/position-detail/header";
import { PositionHandoffView } from "@/components/client/position-detail/handoff-view";
import { HiringProcessSection } from "@/components/client/position-detail/hiring-process-section";
import { ActivitySection } from "@/components/client/position-detail/activity-section";

/**
 * One payload for the whole role. The server returns the role, its pipeline,
 * timeline, lifecycle, closure, recap and open information requests together,
 * so the page has a single loading state and a single retry.
 */
const positionDetailQuery = (orgId: string, positionId: string) =>
  queryOptions({
    queryKey: ["client-position", orgId, positionId],
    queryFn: () => getClientPositionDetail({ data: { orgId, positionId } }),
  });

export const Route = createFileRoute("/_authenticated/client/positions/$id")({
  head: () => ({
    meta: [
      { title: "Position · Client workspace" },
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
  notFoundComponent: () => <div className="p-8">Position not found.</div>,
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.positions.$id.tsx"),
  component: PositionDetailPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function PositionDetailPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  // No resolved workspace means no role to show; the layout already redirects
  // callers with no membership, so this is only the brief pre-resolve window.
  if (!orgId) return <PositionDetailPending />;
  return <PositionDetailView orgId={orgId} ctx={ctx} />;
}

function PositionDetailView({ orgId, ctx }: { orgId: string; ctx: AnyRow }) {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const moveFn = useServerFn(moveMatchStage);
  const support = useSupportView();
  const queryKey = ["client-position", orgId, id];
  // One request for the primary payload: role, pipeline, timeline, lifecycle,
  // closure, recap and open information requests.
  const { data, refetch, isFetching } = useSuspenseQuery(positionDetailQuery(orgId, id));
  const lifecycle = data?.lifecycle ?? null;
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

  const [dragOver, setDragOver] = useState<MatchStage | null>(null);
  const [declining, setDeclining] = useState<{ matchId: string; name: string | null } | null>(null);

  const confirmBlueprintFn = useServerFn(confirmRoleBlueprint);
  const confirmBlueprint = useMutation({
    mutationFn: () => confirmBlueprintFn({ data: { orgId: orgId!, positionId: id } }),
    onSuccess: () => {
      toast.success("Thanks — we've noted your sign-off on this brief.");
      void refetch();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "We couldn't record that. Please try again."),
  });

  const move = useMutation({
    mutationFn: (v: { matchId: string; toStage: MatchStage; reason?: string; reasonCode?: string }) =>
      moveFn({
        data: {
          orgId: orgId!,
          matchId: v.matchId,
          toStage: v.toStage,
          // The stage this candidate was on when the operator grabbed the card.
          // If they have already moved, the server refuses the change.
          expectedStage:
            ((qc.getQueryData<AnyRow>(queryKey)?.matches as AnyRow[] | undefined) ?? []).find(
              (m: AnyRow) => m.id === v.matchId,
            )?.stage as string | undefined,
          reason: v.reason,
          reasonCode: v.reasonCode,
        },
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey });
      const snapshot = qc.getQueryData<AnyRow>(queryKey);
      qc.setQueryData<AnyRow>(queryKey, (prev: AnyRow) => {
        if (!prev) return prev;
        return {
          ...prev,
          matches: prev.matches.map((m: AnyRow) =>
            m.id === v.matchId ? { ...m, stage: v.toStage } : m,
          ),
        };
      });
      return { snapshot };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot);
      // Someone else already moved this candidate: block the action, restore the
      // board and explain what changed rather than reporting a failed save.
      const stale = readStaleStateError(e);
      if (stale) {
        void refetch();
        toast.error("This candidate already moved", { description: stale.message, duration: 12_000 });
        return;
      }
      const raw = e.message.replace(/^Error: /, "");
      const gate = readAdvanceGateError(raw);
      const msg = gate
        ? gate
        : raw.startsWith("invalid_transition")
        ? "That move is not allowed for this stage."
        : raw === "reason_required"
        ? "A reason is required to mark a candidate as not moving forward."
        : raw === "SUPPORT_VIEW_READ_ONLY"
        ? "Unavailable while viewing this workspace in read-only support mode."
        : raw === "forbidden"
        ? "You do not have permission to move candidates."
        : raw === "match_not_visible"
        ? "This candidate is no longer available."
        : raw;
      toast.error(msg);
    },
    onSuccess: () => {
      toast.success("Stage updated");
      qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
      qc.invalidateQueries({ queryKey: ["client-positions", orgId] });
      qc.invalidateQueries({ queryKey: ["client-candidates", orgId] });
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const delivered = useMemo(() => {
    if (!data) return [];
    return [...(data.matches as AnyRow[])].sort((a, b) => {
      const at = a.delivered_at ? new Date(a.delivered_at).getTime() : 0;
      const bt = b.delivered_at ? new Date(b.delivered_at).getTime() : 0;
      return bt - at;
    });
  }, [data]);
  void delivered;

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
  const launch = (data as { launch?: RoleLaunchState }).launch;

  // ── Handoff after a hire ────────────────────────────────────────────────────
  // With a confirmed hire on the role, the search view is replaced by what
  // remains: agreed terms, the derived guarantee window, and the outstanding
  // steps. The role stays reachable — messages and history remain open.
  if (handoff) {
    return (
      <PositionHandoffView
        position={position}
        orgId={orgId}
        positionId={id}
        canEdit={canEdit}
      />
    );
  }

  const byStage: Record<string, AnyRow[]> = {};
  for (const col of KANBAN_COLUMNS) byStage[col.key] = [];
  for (const m of matches as AnyRow[]) {
    const s = m.stage as string;
    if (byStage[s]) byStage[s].push(m);
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

  const actionRequired: Array<{ label: string; href?: string }> = [];
  if (summary.delivered > 0) {
    actionRequired.push({
      label: `${summary.delivered} new candidate${summary.delivered === 1 ? "" : "s"} to review`,
    });
  }
  if (summary.offers > 0) {
    actionRequired.push({
      label: `${summary.offers} offer${summary.offers === 1 ? "" : "s"} outstanding`,
    });
  }
  if (position.status === "needs_clarification") {
    actionRequired.push({
      label: "TaaSFlow needs clarification from your team",
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
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
        hasClosure={!!closure}
        clientStatus={data?.summary?.client_status}
        placementLine={placementLine}
        onRefetch={refetch}
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

      {/* Where we are — persistent five-stage tracker + plain-language status */}
      <section className="rounded-xl border bg-card px-4 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Where we are
        </h2>
        <div className="mt-3">
          <RoleProgressTracker progress={data.progress} />
        </div>
        {summary.pipeline_line && (
          <p className="mt-3 border-t pt-3 text-sm font-medium text-foreground/90">
            {summary.pipeline_line}
          </p>
        )}
        <div className="mt-4 border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </h3>
          <div className="mt-3">
            <RoleDatedTimeline
              timeline={data.timeline}
              isLoading={isFetching && !data.timeline}
              onRetry={() => void refetch()}
            />
          </div>
        </div>
      </section>

      {/* Full system workflow — Intake through Hire, derived from real records */}
      <section className="rounded-xl border bg-card px-4 py-4">
        <RoleLifecycleTimeline
          lifecycle={lifecycle}
          isLoading={false}
          onRetry={() => void refetch()}
        />
      </section>

      {/* What we committed to at launch — promise, actual, variance */}
      <SlaScorecard orgId={orgId} positionId={id} title="What we committed to for this role" />

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
          label="In pipeline"
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

      {/* 4. Pipeline (Kanban) */}
      <PipelineBoard
        matches={matches}
        byStage={byStage}
        canEdit={canEdit}
        dragOver={dragOver}
        setDragOver={setDragOver}
        movePending={move.isPending}
        attemptMove={attemptMove}
      />

      {/* 5. Shortlist — standard evidence card per candidate */}
      <RoleShortlist
        orgId={orgId}
        positionId={id}
        firstShortlistExpectedAt={data.first_shortlist_expected_at}
      />

      {/* Same stored delivery commitment the client saw on confirmation */}
      <DeliveryCommitmentBlock
        commitment={buildDeliveryCommitment({
          commitment: data.commitment,
          positionId: id,
          contactName: data.commitment_contact_name,
        })}
      />

      {/* 5b. Role setup timeline + search channels — evidence-backed */}
      {launch && <RoleLaunchPanel launch={launch} />}

      {/* 5c. Generated role blueprint from express onboarding */}
      <GeneratedBlueprintPanel
        position={position}
        audience="client"
        editTo={{ to: "/client/positions/$id/edit", params: { id } }}
        onConfirm={() => confirmBlueprint.mutate()}
        confirming={confirmBlueprint.isPending}
      />

      {/* 6. Role blueprint — ATS-grade source of truth */}
      <RoleBlueprint position={position} activity={activity} />

      {/* 6b. Previously considered — earlier candidates matched to this brief */}
      {orgId && <PreviouslyConsidered orgId={orgId} positionId={id} />}

      {/* 7. Hiring process */}
      <HiringProcessSection
        mattersCount={matches.length}
        shortlistedTotal={summary.shortlisted + summary.interviewing + summary.offers + summary.hires}
        interviewingTotal={summary.interviewing + summary.offers + summary.hires}
        offersTotal={summary.offers + summary.hires}
        hiresTotal={summary.hires}
        openings={summary.openings}
      />

      {/* 8. Activity */}
      <ActivitySection activity={activity} />

      {/* 9. Messages — one thread per role */}
      {orgId && (
        <RoleMessagesPanel
          orgId={orgId}
          positionId={position.id}
          positionTitle={position.title as string | undefined}
          canPost={canEdit}
        />
      )}

      <section className="mt-8">
        <RoleMemoryPanel positionId={position.id} canEdit={true} />
      </section>

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
    </main>
  );
}
