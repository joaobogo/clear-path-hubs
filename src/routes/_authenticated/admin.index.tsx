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
    L.processing_issues.length;

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

      {totalAction === 0 && (
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
          moreTo="/admin/positions"
          moreSearch={{ status: "submitted" }}
          emptyLabel="No new intakes this week."
          items={L.new_intakes}
          render={(p: Row) => (
            <RecordLink
              key={p.id}
              to="/admin/positions/$id"
              params={{ id: p.id }}
              title={p.title}
              subtitle={p.organizations?.name ?? "—"}
              time={p.created_at}
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
