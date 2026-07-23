import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Briefcase,
  UserPlus,
  ClipboardCheck,
  Send,
  AlertOctagon,
  MessagesSquare,
  History,
  ArrowRight,
  RefreshCw,
  Building2,
  CalendarClock,
} from "lucide-react";

import type { ComponentType, ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-overview"],
      queryFn: () => getAdminOverview(),
    }),
  errorComponent: ({ error }) => (
    <div className="rounded-lg border bg-card p-6 text-sm text-destructive">
      Overview unavailable: {error.message}
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Overview · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Overview,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function fmtErr(code: string | null): string {
  if (!code) return "issue";
  return code.replace(/_/g, " ");
}

function Overview() {
  const qc = useQueryClient();
  const { data, isFetching } = useSuspenseQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const L = data.lists;
  const totalAction =
    L.candidates_pending_review.length +
    L.candidates_ready_to_publish.length +
    L.positions_review.length +
    L.processing_issues.length +
    (L.urgent_interviews?.length ?? 0) +
    (L.intake_inbox?.length ?? 0) +
    L.client_requests.length;

  // Prioritized Action Required — one panel that surfaces the top items
  // waiting on the platform team, in urgency order. Every row deep-links
  // to the exact record and disappears from here once actioned.
  type ActionRow = {
    key: string;
    priority: number;
    label: string;
    detail: string;
    to: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    search?: any;
    tone: "danger" | "warn" | "info";
    time?: string | null;
  };
  const actions: ActionRow[] = [];
  // 1. Processing incidents — grouped into a single primary card, ordered by newest.
  if (L.processing_issues.length > 0) {
    const top = L.processing_issues[0] as Row;
    actions.push({
      key: "processing",
      priority: 1,
      label: `${L.processing_issues.length} processing incident${L.processing_issues.length === 1 ? "" : "s"}`,
      detail: `Latest: ${fmtErr(top.processing_error_code ?? top.processing_state)} · ${top.candidate_profiles?.full_name ?? "Candidate"}`,
      to: "/admin/operations",
      tone: "danger",
      time: top.processing_updated_at,
    });
  }
  // 2. Urgent interviews — requested / imminent, blocking client trust.
  for (const iv of (L.urgent_interviews ?? []).slice(0, 3) as Row[]) {
    const cand = iv.candidate_matches?.candidate_profiles?.full_name ?? "Candidate";
    const pos = iv.candidate_matches?.positions?.title ?? "—";
    const org = iv.candidate_matches?.positions?.organizations?.name ?? "—";
    actions.push({
      key: `iv:${iv.id}`,
      priority: 2,
      label:
        iv.status === "requested"
          ? `Schedule interview — ${cand}`
          : `Interview soon — ${cand}`,
      detail: `${pos} · ${org}`,
      to: "/admin/candidates/$id",
      params: { id: iv.candidate_match_id },
      tone: iv.status === "requested" ? "warn" : "danger",
      time: iv.scheduled_at ?? iv.requested_at,
    });
  }
  // 3. Intake inbox — submissions that still need conversion / review.
  for (const it of (L.intake_inbox ?? []).slice(0, 3) as Row[]) {
    actions.push({
      key: `intake:${it.id}`,
      priority: 3,
      label: it.requisition_pending
        ? `Convert intake — ${it.company_name}`
        : `Review intake — ${it.company_name}`,
      detail: it.role_title,
      to: "/admin/intake/$id",
      params: { id: it.id },
      tone: it.requisition_pending ? "warn" : "info",
      time: it.created_at,
    });
  }
  // 4. Candidates ready to publish — approved, blocking delivery.
  for (const m of L.candidates_ready_to_publish.slice(0, 3) as Row[]) {
    actions.push({
      key: `publish:${m.id}`,
      priority: 4,
      label: `Publish ${m.candidate_profiles?.full_name ?? "candidate"}`,
      detail: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
      to: "/admin/candidates/$id",
      params: { id: m.id },
      tone: "warn",
      time: m.updated_at,
    });
  }
  // 5. Candidates pending review — blocking client delivery.
  for (const m of L.candidates_pending_review.slice(0, 3) as Row[]) {
    actions.push({
      key: `review:${m.id}`,
      priority: 5,
      label: `Review ${m.candidate_profiles?.full_name ?? "candidate"}`,
      detail: `${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`,
      to: "/admin/candidates/$id",
      params: { id: m.id },
      tone: "info",
      time: m.updated_at,
    });
  }
  // 6. Positions awaiting approval.
  for (const p of L.positions_review.slice(0, 2) as Row[]) {
    actions.push({
      key: `pos:${p.id}`,
      priority: 6,
      label: `Approve position — ${p.title}`,
      detail: p.organizations?.name ?? "—",
      to: "/admin/positions/$id",
      params: { id: p.id },
      tone: "info",
      time: p.created_at,
    });
  }
  // 7. Client-initiated recompute / feedback.
  for (const d of L.client_requests.slice(0, 2) as Row[]) {
    actions.push({
      key: `req:${d.id}`,
      priority: 7,
      label: `Client decision — ${d.candidate_matches?.candidate_profiles?.full_name ?? "Candidate"}`,
      detail: `${String(d.decision_type).replace(/_/g, " ")} · ${d.candidate_matches?.positions?.title ?? "—"}`,
      to: "/admin/candidates/$id",
      params: { id: d.candidate_match_id },
      tone: "info",
      time: d.created_at,
    });
  }
  actions.sort((a, b) => a.priority - b.priority);
  const topActions = actions.slice(0, 10);


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Command centre</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything waiting on the platform team. Every row opens the exact record.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Updated {relTime(data.generated_at)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2"
            onClick={() => qc.invalidateQueries({ queryKey: ["admin-overview"] })}
            disabled={isFetching}
            aria-label="Refresh overview"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* ─── Triage summary: what matters in 10 seconds. ─── */}
      <TriageStrip
        blocked={L.processing_issues.length}
        review={L.candidates_pending_review.length}
        publish={L.candidates_ready_to_publish.length}
        urgent={(L.urgent_interviews ?? []).length}
        intake={(L.intake_inbox ?? []).length}
        positions={L.positions_review.length}
      />


      {/* Action Required — prioritized single panel. */}
      {topActions.length > 0 ? (
        <section className="rounded-xl border-2 border-primary/30 bg-primary/[0.03] shadow-sm">
          <header className="flex items-center justify-between border-b border-primary/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Action required</h2>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                {totalAction}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Prioritized by urgency</span>
          </header>
          <ul className="divide-y divide-primary/10">
            {topActions.map((a) => (
              <li key={a.key}>
                <Link
                  to={a.to}
                  params={a.params}
                  search={a.search}
                  className="flex items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-primary/[0.06] focus-visible:bg-primary/[0.06]"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      a.tone === "danger"
                        ? "bg-destructive"
                        : a.tone === "warn"
                          ? "bg-warning"
                          : "bg-primary"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{a.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.detail}</div>
                  </div>
                  <span className="hidden w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground sm:inline">
                    {relTime(a.time)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center">
          <ClipboardCheck className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold">Inbox zero</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            No positions, candidates, or processing incidents need attention right now.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Candidates awaiting review"
          desc="Scored — pending admin decision."
          icon={ClipboardCheck}
          count={data.candidates_review}
          moreTo="/admin/candidates"
          moreSearch={{ admin_status: "pending", processing_state: "scored" }}
          emptyLabel="No candidates waiting for review."
          items={L.candidates_pending_review}
          render={(m: Row) => (
            <RecordLink
              key={m.id}
              to="/admin/candidates/$id"
              params={{ id: m.id }}
              title={`Review — ${m.candidate_profiles?.full_name ?? "Candidate"}`}
              subtitle={`${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`}
              time={m.updated_at}
              badge={
                m.score_runs?.score != null ? (
                  <Badge>{Math.round(Number(m.score_runs.score))}</Badge>
                ) : null
              }
            />
          )}
        />

        <Section
          title="Ready to publish"
          desc="Approved but not yet visible to the client."
          icon={Send}
          count={data.candidates_ready}
          moreTo="/admin/publish"
          emptyLabel="No candidates approved and waiting."
          items={L.candidates_ready_to_publish}
          render={(m: Row) => (
            <RecordLink
              key={m.id}
              to="/admin/candidates/$id"
              params={{ id: m.id }}
              title={`Publish — ${m.candidate_profiles?.full_name ?? "Candidate"}`}
              subtitle={`${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`}
              time={m.updated_at}
              badge={<Badge variant="outline">approved</Badge>}
            />
          )}
        />

        <Section
          title="Positions awaiting review"
          desc="Submitted or in clarification — needs approval."
          icon={Briefcase}
          count={data.positions_review}
          moreTo="/admin/positions"
          moreSearch={{ status: "submitted" }}
          emptyLabel="No positions waiting for approval."
          items={L.positions_review}
          render={(p: Row) => (
            <RecordLink
              key={p.id}
              to="/admin/positions/$id"
              params={{ id: p.id }}
              title={p.title}
              subtitle={p.organizations?.name ?? "—"}
              time={p.created_at}
              badge={
                <Badge variant="secondary" className="capitalize">
                  {String(p.status).replace(/_/g, " ")}
                </Badge>
              }
            />
          )}
        />

        <Section
          title="New intakes"
          desc="Client briefs submitted in the last 7 days."
          icon={Inbox}
          count={data.new_intakes}
          moreTo="/admin/intake"
          emptyLabel="No new intakes this week."
          items={L.new_intakes}
          render={(it: Row) => (
            <RecordLink
              key={it.id}
              to="/admin/intake/$id"
              params={{ id: it.id }}
              title={it.company_name}
              subtitle={it.role_title}
              time={it.created_at}
              badge={
                it.requisition_pending ? (
                  <Badge variant="destructive">needs conversion</Badge>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {String(it.workspace_status ?? it.status).replace(/_/g, " ")}
                  </Badge>
                )
              }
            />
          )}
        />

        <Section
          title="Urgent interview activity"
          desc="Requested or scheduled within the next 48h."
          icon={CalendarClock}
          count={data.urgent_interviews ?? 0}
          moreTo="/admin/candidates"
          moreSearch={{ has_interview: "true" }}
          emptyLabel="No urgent interviews."
          items={L.urgent_interviews ?? []}
          render={(iv: Row) => (
            <RecordLink
              key={iv.id}
              to="/admin/candidates/$id"
              params={{ id: iv.candidate_match_id }}
              title={iv.candidate_matches?.candidate_profiles?.full_name ?? "Candidate"}
              subtitle={`${iv.candidate_matches?.positions?.title ?? "—"} · ${iv.candidate_matches?.positions?.organizations?.name ?? "—"}`}
              time={iv.scheduled_at ?? iv.requested_at}
              badge={
                <Badge
                  variant={iv.status === "requested" ? "outline" : "destructive"}
                  className="capitalize"
                >
                  {iv.status}
                </Badge>
              }
            />
          )}
        />


        <Section
          title="New applications (24h)"
          desc="Candidate submissions currently flowing through the pipeline."
          icon={UserPlus}
          count={data.new_applications}
          moreTo="/admin/candidates"
          emptyLabel="No new applications in the last 24 hours."
          items={L.new_applications}
          render={(m: Row) => (
            <RecordLink
              key={m.id}
              to="/admin/candidates/$id"
              params={{ id: m.id }}
              title={m.candidate_profiles?.full_name ?? "Candidate"}
              subtitle={`${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`}
              time={m.created_at}
              badge={
                <Badge variant="secondary" className="capitalize">
                  {String(m.processing_state).replace(/_/g, " ")}
                </Badge>
              }
            />
          )}
        />

        <Section
          title="Processing issues"
          desc="Parse, provider, OCR, or manual-review incidents."
          icon={AlertOctagon}
          count={data.processing_failures}
          moreTo="/admin/operations"
          emptyLabel="Pipeline is healthy."
          items={L.processing_issues}
          render={(m: Row) => (
            <RecordLink
              key={m.id}
              to="/admin/candidates/$id"
              params={{ id: m.id }}
              title={m.candidate_profiles?.full_name ?? "Candidate"}
              subtitle={`${m.positions?.title ?? "—"} · ${m.positions?.organizations?.name ?? "—"}`}
              time={m.processing_updated_at}
              badge={
                <Badge variant="destructive" className="capitalize">
                  {fmtErr(m.processing_error_code ?? m.processing_state)}
                </Badge>
              }
            />
          )}
        />

        <Section
          title="Client actions (7d)"
          desc="Recompute requests raised by clients."
          icon={MessagesSquare}
          count={data.client_requests}
          moreTo="/admin/messages"
          emptyLabel="No client requests in the last 7 days."
          items={L.client_requests}
          render={(d: Row) => (
            <RecordLink
              key={d.id}
              to="/admin/candidates/$id"
              params={{ id: d.candidate_match_id }}
              title={`Recompute — ${d.candidate_matches?.candidate_profiles?.full_name ?? "Candidate"}`}
              subtitle={`${d.candidate_matches?.positions?.title ?? "—"} · ${
                d.candidate_matches?.positions?.organizations?.name ?? "—"
              }`}
              time={d.created_at}
              badge={
                <Badge variant="outline" className="capitalize">
                  {String(d.decision_type).replace(/_/g, " ")}
                </Badge>
              }
            />
          )}
        />

        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <div>
                <h2 className="text-sm font-semibold">Important activity</h2>
                <p className="text-xs text-muted-foreground">
                  Latest write events across the platform.
                </p>
              </div>
            </div>
            <Link
              to="/admin/operations"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Audit log <ArrowRight className="h-3 w-3" />
            </Link>
          </header>
          {data.recent_activity.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              No recent activity.
            </div>
          ) : (
            <ul className="divide-y">
              {data.recent_activity.slice(0, 8).map((a: Row) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-xs"
                >
                  <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
                    {relTime(a.created_at)}
                  </span>
                  <span className="font-medium capitalize">
                    {String(a.action).replace(/[._]/g, " ")}
                  </span>
                  <span className="truncate text-muted-foreground">
                    {a.entity_type}
                  </span>
                  {a.organization_id && (
                    <Building2 className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Reusable section shell ─────────────────────────────────────────────────

function Section<T extends { id: string }>({
  title,
  desc,
  icon: Icon,
  count,
  items,
  render,
  moreTo,
  moreSearch,
  emptyLabel,
}: {
  title: string;
  desc: string;
  icon: ComponentType<{ className?: string }>;
  count: number;
  items: T[];
  render: (item: T) => ReactNode;
  moreTo: string;
  moreSearch?: Record<string, string>;
  emptyLabel: string;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="truncate">{title}</span>
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                  count > 0
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        {count > items.length && (
          <Link
            to={moreTo}
            search={moreSearch as never}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </header>
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <ul className="divide-y">{items.map((it) => render(it))}</ul>
      )}
    </section>
  );
}

function RecordLink({
  to,
  params,
  title,
  subtitle,
  time,
  badge,
}: {
  to: string;
  params?: Record<string, string>;
  title: string;
  subtitle?: string;
  time?: string | null;
  badge?: ReactNode;
}) {
  return (
    <li>
      <Link
        to={to}
        params={params as never}
        className="flex items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle && (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>
        {badge}
        <span className="hidden w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground sm:inline">
          {relTime(time)}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      </Link>
    </li>
  );
}
