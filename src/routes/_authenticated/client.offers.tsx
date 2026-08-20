import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HandCoins } from "lucide-react";
import { formatMoneyMajorCompact } from "@/lib/money";
import {
  listHires,
  getTimeToHireReport,
  HIRE_STATUSES,
  HIRE_STATUS_LABEL,
  CLOSE_REASON_LABEL,
  type HireRecordDTO,
  type HireStatus,
} from "@/lib/hires.functions";
import { OfferHolderRows } from "@/components/client/offer-holder-rows";
import { getClientContext } from "@/lib/client-context.functions";
import { isStalled, byStallDesc } from "@/lib/offer-stall";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { SkeletonBoard } from "@/components/client/states";
import { QueryErrorCard } from "@/components/client/query-error";
import { ViewerReadOnlyNotice } from "@/components/client/states";
import { Badge } from "@/components/ui/badge";
import { makeWorkspacePending } from "@/components/workspace/pending-states";
import { useRouteRealtime } from "@/hooks/use-route-realtime";
import { LiveUpdatedChip } from "@/components/client/live-updated-chip";
import { COLUMN_ORDER } from "@/components/client/offers/helpers";
import { Column } from "@/components/client/offers/column";
import { Kpi } from "@/components/client/offers/kpi";
import { OffersEmptyState } from "@/components/client/offers/offers-empty-state";
import { StalledOffersPanel } from "@/components/client/offers/stalled-offers-panel";

export const RoutePending = makeWorkspacePending({ shape: "board", kpis: false, width: "7xl" });
export const Route = createFileRoute("/_authenticated/client/offers")({
	pendingMs: 150,
	pendingComponent: RoutePending,
  head: () => ({
    meta: [
      { title: "Offers & hires · TaaSFlow" },
      {
        name: "description",
        content:
          "Track every offer from draft through hire. Assigned owners, close reasons, and time-to-hire reporting in one board.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("client", "src/routes/_authenticated/client.offers.tsx"),
  notFoundComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Not found.</div>
  ),
  component: OffersPage,
});

function OffersPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(listHires);
  const reportFn = useServerFn(getTimeToHireReport);

  const ctxQuery = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const ctx = ctxQuery.data;
  const orgId = ctx?.active?.organization_id;

  // Offers move as candidates move. Refresh the board in place and say so.
  const live = useRouteRealtime({
    scope: "client-offers",
    orgId: orgId ?? null,
    invalidateKeys: [["hires", orgId], ["hires-report", orgId], ["client-kpis"]],
  });
  const readOnly = ctx?.active?.role === "client_viewer";

  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["hires", orgId],
    queryFn: () => listFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  const reportQuery = useQuery({
    queryKey: ["hires-report", orgId],
    queryFn: () => reportFn({ data: { orgId: orgId!, sinceDays: 180 } }),
    enabled: !!orgId,
  });
  const report = reportQuery.data;

  const hires = data?.hires ?? [];
  const byStatus = useMemo(() => {
    const m = new Map<HireStatus, HireRecordDTO[]>();
    for (const s of HIRE_STATUSES) m.set(s, []);
    for (const h of hires) m.get(h.status)?.push(h);
    return m;
  }, [hires]);

  const stalled = useMemo(
    () => hires.filter((h) => isStalled(h)).sort((a, b) => byStallDesc(a, b)),
    [hires],
  );

  if (ctxQuery.isError) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
        <QueryErrorCard
          title="We couldn't load your workspace"
          error={ctxQuery.error}
          onRetry={() => ctxQuery.refetch()}
          retrying={ctxQuery.isFetching}
        />
      </div>
    );
  }

  if (!orgId) return <RoutePending />;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            <HandCoins className="h-6 w-6 text-primary" aria-hidden />
            Offers & hires
            <LiveUpdatedChip updatedAt={live.updatedAt} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track every offer from draft through signed hire, with owner
            accountability, close reasons, and time-to-hire on one board.
          </p>
        </div>
      </header>

      {readOnly ? (
        <ViewerReadOnlyNotice className="mt-5" area="moving offers and confirming hires" />
      ) : null}

      {/* KPI strip */}
      {reportQuery.isError ? (
        <section className="mt-5">
          <QueryErrorCard
            title="We couldn't load the time-to-hire report"
            error={reportQuery.error}
            onRetry={() => reportQuery.refetch()}
            retrying={reportQuery.isFetching}
            compact
          />
        </section>
      ) : (
        (() => {
          // While the report is in flight, a literal 0 reads as "no offers" and
          // contradicts the board underneath. Show an em dash until it lands.
          const pendingReport = reportQuery.isPending || !report;
          const num = (v: number | null | undefined) =>
            pendingReport ? "—" : (v ?? 0);
          const reportIncomplete = report?.totals?.salary_report_incomplete;
          const hiresCount = report?.totals?.hires_confirmed;
          const openCount = report?.totals?.open_offers;
          const acceptanceRate = report?.totals?.acceptance_rate;

          return (
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Open offers"
                value={num(openCount)}
                hint="Drafted, sent, or accepted"
              />
              <Kpi
                label="Hires confirmed"
                value={num(hiresCount)}
                hint="Last 180 days"
              />
              <Kpi
                label="Acceptance rate"
                value={
                  pendingReport
                    ? "—"
                    : acceptanceRate == null
                      ? "Not enough data"
                      : `${Math.round(acceptanceRate * 100)}%`
                }
                hint={
                  acceptanceRate == null && !pendingReport
                    ? "No offers have been decided yet"
                    : "Accepted ÷ decided"
                }
              />
              <Kpi
                label="Avg salary"
                value={
                  pendingReport
                    ? "—"
                    : report?.totals.avg_salary == null
                      ? "Not enough data"
                      : `${formatMoneyMajorCompact(report.totals.avg_salary)}${reportIncomplete ? "*" : ""}`
                }
                hint={
                  !pendingReport && report?.totals.avg_salary == null
                    ? "No confirmed hire has compensation on record"
                    : reportIncomplete
                      ? `Based on ${report?.totals.accepted_offers} of ${report?.totals.hires_confirmed} hires with compensation on record`
                      : "Confirmed hires average"
                }
              />

            </div>
          );
        })()
      )}


      {/* Who owes what — one row per offer, holder derived from events */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold">Who owes what</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Status, whose turn it is, and the response date that was agreed.
        </p>
        <div className="mt-3">
          <OfferHolderRows
            orgId={orgId}
            hires={hires}
            isPending={isPending}
            isError={isError}
            onRetry={() => void refetch()}
            readOnly={!!readOnly}
          />
        </div>
      </section>

      {/* Stalled offers */}
      <StalledOffersPanel stalled={stalled} orgId={orgId} readOnly={!!readOnly} />

      {/* Board */}
      <section className="mt-6 overflow-x-auto max-sm:overflow-x-visible">
        {isError ? (
          <QueryErrorCard
            title="We couldn't load your offers"
            error={error}
            onRetry={() => refetch()}
            retrying={isFetching}
          />
        ) : isPending ? (
          <SkeletonBoard columns={6} />
        ) : hires.length === 0 ? (
          <OffersEmptyState orgId={orgId} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:min-w-[1100px] sm:grid-cols-6">
            {COLUMN_ORDER.map((status) => (
              <Column
                key={status}
                status={status}
                items={byStatus.get(status) ?? []}
                orgId={orgId}
                readOnly={!!readOnly}
                onChanged={() => refetch()}
              />
            ))}
          </div>
        )}
      </section>

      {/* Reporting: by owner + close reasons */}
      {!reportQuery.isError && report && report.totals.hires_confirmed + report.totals.closed_lost > 0 && (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Hires by owner</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {report.by_owner.slice(0, 8).map((o) => (
                <li
                  key={o.owner_user_id ?? "unassigned"}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate">{o.owner_name}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{o.hires}</strong> hires
                    </span>
                    <span>
                      {o.avg_days_to_hire == null
                        ? "—"
                        : `${Math.round(o.avg_days_to_hire)}d avg`}
                    </span>
                  </span>
                </li>
              ))}
              {report.by_owner.length === 0 && (
                <li className="text-xs text-muted-foreground">Hires by owner: No hires yet.</li>
              )}
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Close reasons</h2>
            {report.close_reasons.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No offers declined or closed lost in this window.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {report.close_reasons.map((r) => (
                  <li key={r.reason} className="flex items-center justify-between">
                    <span>{CLOSE_REASON_LABEL[r.reason]}</span>
                    <Badge variant="outline" className="text-xs">
                      {r.count}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

