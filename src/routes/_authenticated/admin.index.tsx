import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/admin.functions";
import { getCommandCenter } from "@/lib/admin-command.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
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
  Filter,
  Layers,
} from "lucide-react";

import type { ComponentType, ReactNode } from "react";

const searchSchema = z.object({
  org: fallback(z.string(), "").default(""),
  position: fallback(z.string(), "").default(""),
  owner: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/admin/")({
  validateSearch: zodValidator(searchSchema),
  search: {
    // Keep the URL clean: only non-default filters appear.
    middlewares: [
      stripSearchParams({ org: "", position: "", owner: "", status: "", from: "", to: "" }),
    ],
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-overview"],
      queryFn: () => getAdminOverview(),
    }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.index.tsx"),
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/admin" });
  const { data, isFetching } = useSuspenseQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const filters = {
    org_id: search.org || undefined,
    position_id: search.position || undefined,
    owner_id: search.owner || undefined,
    status: search.status || undefined,
    from: search.from ? new Date(search.from).toISOString() : undefined,
    to: search.to ? new Date(`${search.to}T23:59:59`).toISOString() : undefined,
  };
  const command = useQuery({
    queryKey: ["admin-command", filters],
    queryFn: () => getCommandCenter({ data: filters }),
    staleTime: 30_000,
  });

  const setFilter = (key: keyof typeof search, value: string) =>
    navigate({
      search: (prev: Record<string, string>) => ({
        ...prev,
        [key]: value,
        ...(key === "org" ? { position: "" } : {}),
      }),
    });
  const clearFilters = () =>
    navigate({ search: { org: "", position: "", owner: "", status: "", from: "", to: "" } });

  const L = data.lists;


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
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["admin-overview"] });
              qc.invalidateQueries({ queryKey: ["admin-command"] });
            }}
            disabled={isFetching}
            aria-label="Refresh overview"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* ─── Filters — persisted in the URL so views are shareable. ─── */}
      <CommandFilters
        options={command.data?.options}
        search={search}
        onChange={setFilter}
        onClear={clearFilters}
        activeCount={
          [search.org, search.position, search.owner, search.status, search.from, search.to].filter(
            Boolean,
          ).length
        }
      />

      {/* ─── Triage summary: platform-wide exact counts. ─── */}
      <TriageStrip
        blocked={data.processing_failures}
        review={data.candidates_review}
        publish={data.candidates_ready}
        urgent={data.urgent_interviews ?? 0}
        intake={data.new_intakes}
        positions={data.positions_review}
      />

      {/* ─── Urgent queue — filter aware, every row deep-links. ─── */}
      <UrgentQueue
        loading={command.isLoading}
        error={command.error ? String((command.error as Error).message) : null}
        items={command.data?.urgent ?? []}
        counts={command.data?.urgent_counts ?? {}}
        filtersActive={command.data?.filters_active ?? false}
        platformHasWork={command.data?.platform_has_work ?? true}
        onClear={clearFilters}
      />

      {/* ─── Workload by client and job. ─── */}
      <Workload
        loading={command.isLoading}
        clients={command.data?.workload ?? []}
        filtersActive={command.data?.filters_active ?? false}
        platformHasWork={command.data?.platform_has_work ?? true}
        onClear={clearFilters}
      />


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
            <Link
              to="/admin/business-rules"
              className="ml-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Business rules <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              to="/admin/design-system"
              className="ml-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Design system <ArrowRight className="h-3 w-3" />
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
        <ActivityFeed limit={10} title="Platform activity" />
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

function TriageStrip({
  blocked,
  review,
  publish,
  urgent,
  intake,
  positions,
}: {
  blocked: number;
  review: number;
  publish: number;
  urgent: number;
  intake: number;
  positions: number;
}) {
  const tiles: Array<{
    label: string;
    value: number;
    to: string;
    search?: Record<string, string>;
    tone: "danger" | "warn" | "info" | "neutral";
    hint: string;
  }> = [
    { label: "Blocked", value: blocked, to: "/admin/operations", tone: "danger", hint: "Processing incidents" },
    { label: "Urgent interviews", value: urgent, to: "/admin/candidates", search: { has_interview: "true" }, tone: "danger", hint: "Requested / ≤ 48h" },
    { label: "Awaiting review", value: review, to: "/admin/candidates", search: { admin_status: "pending", processing_state: "scored" }, tone: "warn", hint: "Scored, not decided" },
    { label: "Ready to publish", value: publish, to: "/admin/publish", tone: "warn", hint: "Approved, not delivered" },
    { label: "New intake", value: intake, to: "/admin/intake", tone: "info", hint: "Client briefs" },
    { label: "Positions to approve", value: positions, to: "/admin/positions", search: { status: "submitted" }, tone: "info", hint: "Awaiting approval" },
  ];
  const toneCls = (t: "danger" | "warn" | "info" | "neutral", v: number) => {
    if (v === 0) return "border-border bg-muted/30 text-muted-foreground";
    if (t === "danger") return "border-destructive/40 bg-destructive/[0.06] text-foreground";
    if (t === "warn") return "border-warning/50 bg-warning/[0.06] text-foreground";
    return "border-primary/30 bg-primary/[0.04] text-foreground";
  };
  const dotCls = (t: "danger" | "warn" | "info" | "neutral", v: number) => {
    if (v === 0) return "bg-muted-foreground/40";
    if (t === "danger") return "bg-destructive";
    if (t === "warn") return "bg-warning";
    return "bg-primary";
  };
  return (
    <section aria-label="Triage summary" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <Link
          key={t.label}
          to={t.to}
          search={t.search as never}
          className={`group rounded-lg border px-3 py-2.5 transition hover:shadow-sm ${toneCls(t.tone, t.value)}`}
        >
          <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${dotCls(t.tone, t.value)}`} aria-hidden />
            <span className="truncate">{t.label}</span>
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums leading-none">{t.value}</div>
          <div className="mt-1 text-[10.5px] text-muted-foreground truncate">{t.hint}</div>
        </Link>
      ))}
    </section>
  );
}


// ── Filters (URL-persisted) ────────────────────────────────────────────────

type FilterOptions = {
  organizations: { id: string; name: string }[];
  positions: { id: string; title: string; status: string; organization_id: string }[];
  owners: { id: string; name: string }[];
  statuses: string[];
};

function CommandFilters({
  options,
  search,
  onChange,
  onClear,
  activeCount,
}: {
  options?: FilterOptions;
  search: { org: string; position: string; owner: string; status: string; from: string; to: string };
  onChange: (key: "org" | "position" | "owner" | "status" | "from" | "to", value: string) => void;
  onClear: () => void;
  activeCount: number;
}) {
  const positions = (options?.positions ?? []).filter(
    (p) => !search.org || p.organization_id === search.org,
  );
  const field =
    "h-9 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <section
      aria-label="Dashboard filters"
      className="rounded-lg border bg-card p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
              {activeCount}
            </span>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <label className="sr-only" htmlFor="f-org">Client</label>
          <select
            id="f-org"
            className={field}
            value={search.org}
            onChange={(e) => onChange("org", e.target.value)}
          >
            <option value="">All clients</option>
            {(options?.organizations ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-pos">Job</label>
          <select
            id="f-pos"
            className={field}
            value={search.position}
            onChange={(e) => onChange("position", e.target.value)}
          >
            <option value="">All jobs</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-owner">Owner</label>
          <select
            id="f-owner"
            className={field}
            value={search.owner}
            onChange={(e) => onChange("owner", e.target.value)}
          >
            <option value="">All owners</option>
            {(options?.owners ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-status">Job status</label>
          <select
            id="f-status"
            className={field}
            value={search.status}
            onChange={(e) => onChange("status", e.target.value)}
          >
            <option value="">Any job status</option>
            {(options?.statuses ?? []).map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="f-from">From date</label>
          <input
            id="f-from"
            type="date"
            className={field}
            value={search.from}
            onChange={(e) => onChange("from", e.target.value)}
          />
          <label className="sr-only" htmlFor="f-to">To date</label>
          <input
            id="f-to"
            type="date"
            className={field}
            value={search.to}
            onChange={(e) => onChange("to", e.target.value)}
          />
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
    </section>
  );
}

// ── Urgent queue ───────────────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  parsing_failed: "Processing",
  intake_incomplete: "Intake",
  screening_review: "Screening review",
  awaiting_client_release: "Awaiting release",
  overdue_feedback: "Overdue feedback",
  interview_request: "Interviews",
  delivery_risk: "Delivery risk",
  integration_failure: "Integrations",
};

function UrgentQueue({
  loading,
  error,
  items,
  counts,
  filtersActive,
  platformHasWork,
  onClear,
}: {
  loading: boolean;
  error: string | null;
  items: Row[];
  counts: Record<string, number>;
  filtersActive: boolean;
  platformHasWork: boolean;
  onClear: () => void;
}) {
  return (
    <section className="rounded-xl border-2 border-primary/30 bg-primary/[0.03] shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold">Urgent queue</h2>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
            {items.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(counts).map(([kind, n]) => (
            <span
              key={kind}
              className="rounded-full border border-primary/20 bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {KIND_LABEL[kind] ?? kind} <span className="tabular-nums font-medium">{n}</span>
            </span>
          ))}
        </div>
      </header>

      {error ? (
        <div className="px-4 py-8 text-center text-xs text-destructive">
          Urgent queue unavailable: {error}
        </div>
      ) : loading ? (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading queue…</div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <ClipboardCheck className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          <h3 className="mt-3 text-sm font-semibold">
            {filtersActive
              ? "No urgent items match these filters"
              : platformHasWork
                ? "Inbox zero"
                : "Nothing here yet"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtersActive
              ? "Urgent work may still exist outside the current filter."
              : platformHasWork
                ? "No blocked, overdue, or unreviewed work right now."
                : "Urgent items appear once clients and positions exist."}
          </p>
          {filtersActive && (
            <Button variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={onClear}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-primary/10">
          {items.slice(0, 12).map((a: Row) => (
            <li key={a.id}>
              <Link
                to={a.to}
                params={a.param ? ({ id: a.param } as never) : undefined}
                className="flex items-center gap-3 px-4 py-2.5 outline-none transition-colors hover:bg-primary/[0.06] focus-visible:bg-primary/[0.06]"
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    a.severity === "critical"
                      ? "bg-destructive"
                      : a.severity === "high"
                        ? "bg-warning"
                        : "bg-primary"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.detail}</div>
                </div>
                <span className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] text-muted-foreground sm:inline">
                  {KIND_LABEL[a.kind] ?? a.kind}
                </span>
                <span className="hidden w-16 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground sm:inline">
                  {relTime(a.occurred_at)}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 12 && (
        <footer className="border-t border-primary/10 px-4 py-2 text-[11px] text-muted-foreground">
          Showing the 12 most urgent of {items.length}. Narrow with filters to see the rest.
        </footer>
      )}
    </section>
  );
}

// ── Workload by client and job ─────────────────────────────────────────────

function Workload({
  loading,
  clients,
  filtersActive,
  platformHasWork,
  onClear,
}: {
  loading: boolean;
  clients: Row[];
  filtersActive: boolean;
  platformHasWork: boolean;
  onClear: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">Workload by client and job</h2>
            <p className="text-xs text-muted-foreground">
              Open roles only. Counts are live records, not estimates.
            </p>
          </div>
        </div>
        <Link
          to="/admin/positions"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          All positions <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </header>

      {loading ? (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">Loading workload…</div>
      ) : clients.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-muted-foreground">
          {filtersActive ? (
            <>
              No open roles match these filters.{" "}
              <button className="text-primary underline" onClick={onClear}>
                Clear filters
              </button>
            </>
          ) : platformHasWork ? (
            "No open roles right now."
          ) : (
            "No clients or positions exist yet."
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Open workload grouped by client and job</caption>
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">Client / job</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">In pipeline</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Awaiting review</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Awaiting release</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Interviews</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Issues</th>
              </tr>
            </thead>
            {clients.map((c: Row) => (
              <tbody key={c.organization_id} className="border-b last:border-0">
                <tr className="bg-muted/40">
                  <th scope="rowgroup" className="px-4 py-2 text-left text-sm font-semibold">
                    <Link
                      to="/admin/clients/$id"
                      params={{ id: c.organization_id }}
                      className="hover:underline"
                    >
                      {c.organization_name}
                    </Link>
                  </th>
                  <td className="px-2 py-2 text-right tabular-nums">{c.totals.in_pipeline}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.totals.awaiting_review}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.totals.awaiting_release}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{c.totals.interviews}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {c.totals.issues > 0 ? (
                      <span className="font-semibold text-destructive">{c.totals.issues}</span>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
                {c.positions.map((p: Row) => (
                  <tr key={p.position_id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <Link
                        to="/admin/positions/$id"
                        params={{ id: p.position_id }}
                        className="flex min-w-0 items-center gap-2 hover:underline"
                      >
                        <span className="truncate pl-3">{p.title}</span>
                        <Badge variant="secondary" className="capitalize">
                          {String(p.status).replace(/_/g, " ")}
                        </Badge>
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.in_pipeline}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.awaiting_review}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.awaiting_release}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{p.interviews}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {p.issues > 0 ? (
                        <span className="font-semibold text-destructive">{p.issues}</span>
                      ) : (
                        0
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}
