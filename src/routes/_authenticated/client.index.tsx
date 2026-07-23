import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getClientContext, getClientOverview } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { CandidateCard } from "@/components/client/candidate-card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/")({
  head: () => ({
    meta: [
      { title: "Overview · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OverviewPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function OverviewPage() {
  const ctxFn = useServerFn(getClientContext);
  const overviewFn = useServerFn(getClientOverview);
  const orgSearch = useClientOrgSearch();
  const qc = useQueryClient();
  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["client-overview", orgId],
    queryFn: () => overviewFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  const kpis = data?.kpis;
  const actions = data?.action_required ?? [];
  const whatsNext = data?.whats_next ?? [];
  const latest = data?.latest_candidates ?? [];
  const messages = data?.recent_messages ?? [];
  const activity = data?.recent_activity ?? [];
  const newThisWeek = data?.new_this_week ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hiring overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What TaaSFlow is working on for {ctx?.active?.name} — and what needs you.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.last_updated && (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(data.last_updated).toLocaleString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["client-overview", orgId] });
            }}
            disabled={isFetching}
            aria-label="Refresh overview"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Link to="/intake">
            <Button size="sm">
              Add a new role
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ─── 1. WHAT IS ACTIVE ─── */}
      <section aria-labelledby="active-heading">
        <SectionTitle
          id="active-heading"
          icon={<Briefcase className="h-4 w-4" />}
          title="What's active"
          hint="Roles TaaSFlow is currently working on."
        />
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile
            label="Active roles"
            value={kpis?.active_positions ?? 0}
            href="/client/positions"
            icon={<Briefcase className="h-3.5 w-3.5" />}
          />
          <KpiTile
            label="Delivered"
            value={kpis?.delivered ?? 0}
            href="/client/candidates"
            hrefSearch={{ filter: "all" }}
            icon={<Users className="h-3.5 w-3.5" />}
            hint="Total profiles you can see"
          />
          <KpiTile
            label="Top matches"
            value={kpis?.top ?? 0}
            href="/client/candidates"
            hrefSearch={{ filter: "top" }}
            icon={<Trophy className="h-3.5 w-3.5" />}
            tone="primary"
          />
          <KpiTile
            label="Shortlisted"
            value={kpis?.shortlisted ?? 0}
            href="/client/candidates"
            hrefSearch={{ filter: "shortlisted" }}
          />
          <KpiTile
            label="In interview"
            value={kpis?.interviewing ?? 0}
            href="/client/candidates"
            hrefSearch={{ filter: "interview" }}
            icon={<CalendarClock className="h-3.5 w-3.5" />}
          />
          <KpiTile
            label="Hires"
            value={kpis?.hires ?? 0}
            href="/client/candidates"
            hrefSearch={{ filter: "hired" }}
            tone="success"
          />
        </div>
      </section>

      {/* ─── 2. WHAT IS NEW & 3. WHAT NEEDS ATTENTION ─── */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <SectionTitle
            icon={<Sparkles className="h-4 w-4 text-primary" />}
            title="What's new"
            hint="Delivered in the past 7 days."
          />
          {newThisWeek === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No new candidates this week — TaaSFlow will notify you the moment one lands.
            </p>
          ) : (
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold tabular-nums">{newThisWeek}</span>
                <span className="text-sm text-muted-foreground">
                  new candidate{newThisWeek === 1 ? "" : "s"} this week
                </span>
              </div>
              <Link
                to="/client/candidates"
                search={{ filter: "new" }}
                className="mt-3 inline-flex items-center text-sm text-primary hover:underline"
              >
                Review new candidates
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <SectionTitle
            icon={
              <AlertTriangle
                className={`h-4 w-4 ${actions.length ? "text-amber-600" : "text-muted-foreground"}`}
              />
            }
            title="Needs your attention"
            hint="Things TaaSFlow can't move without you."
          />
          {actions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing pending — everything is on TaaSFlow's side.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {actions.map((a: Any, i: number) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50/50 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20"
                >
                  <span className="text-sm">{a.label}</span>
                  <Link
                    to={a.href}
                    className="shrink-0 text-sm font-medium text-primary hover:underline"
                  >
                    Open →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ─── 4. WHAT HAPPENS NEXT ─── */}
      {whatsNext.length > 0 && (
        <section aria-labelledby="next-heading">
          <SectionTitle
            id="next-heading"
            icon={<ArrowRight className="h-4 w-4" />}
            title="What happens next"
            hint="Next milestone for each active role."
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {whatsNext.map((p: Any) => (
              <Link
                key={p.position_id}
                to="/client/positions/$id"
                params={{ id: p.position_id }}
                className="group rounded-lg border bg-card p-3 hover:border-primary transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                      {p.status}
                    </div>
                  </div>
                  {p.delivered_pending > 0 && (
                    <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                      {p.delivered_pending} to review
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Next: </span>
                  <span className="text-foreground">{p.next}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest delivered candidates — concise cards, hides internal state */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle
            icon={<Users className="h-4 w-4" />}
            title="Latest delivered candidates"
          />
          <Link to="/client/candidates" className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>
        {latest.length === 0 ? (
          <div className="rounded border bg-card p-8 text-center text-sm text-muted-foreground">
            No candidates delivered yet — you'll see the first ones here.
          </div>
        ) : (
          <div className="grid gap-3">
            {latest.map((c) => (
              <CandidateCard key={c.match_id} candidate={c} />
            ))}
          </div>
        )}
      </section>

      {/* ─── 5. WHAT CHANGED + Messages ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle
              icon={<MessageSquare className="h-4 w-4" />}
              title="Recent messages"
            />
            <Link to="/client/messages" className="text-sm text-primary hover:underline">
              Open →
            </Link>
          </div>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(messages as Any[]).map((m) => (
                <li key={m.id} className="border-b pb-2 last:border-b-0">
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                  <div className="line-clamp-2">{m.body}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-card p-4">
          <SectionTitle
            icon={<RefreshCw className="h-4 w-4" />}
            title="What changed"
            hint="Recent activity in your workspace."
          />
          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing new to show.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {(activity as Any[]).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 border-b pb-1.5 last:border-b-0"
                >
                  <span className="capitalize">{formatAction(String(e.action))}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

// ─── Presentation helpers ────────────────────────────────────────────────────

function SectionTitle({
  id,
  icon,
  title,
  hint,
}: {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
        {icon}
        <span>{title}</span>
      </h2>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function KpiTile({
  label,
  value,
  href,
  hrefSearch,
  icon,
  hint,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  hrefSearch?: Record<string, string>;
  icon?: React.ReactNode;
  hint?: string;
  tone?: "primary" | "success";
}) {
  const toneCls =
    tone === "primary"
      ? "hover:border-primary hover:bg-primary/5"
      : tone === "success"
        ? "hover:border-emerald-500/60 hover:bg-emerald-500/5"
        : "hover:border-muted-foreground/40";
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={href as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search={hrefSearch as any}
      className={`group block rounded-lg border bg-card p-3 transition ${toneCls}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </Link>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    "candidate_match.stage_changed": "Candidate stage updated",
    "client.shortlist": "Candidate shortlisted",
    "client.request_interview": "Interview requested",
    "client.offer": "Offer extended",
    "client.hire": "Hire recorded",
    "client.not_moving_forward": "Candidate declined",
    "client.submit_feedback": "Feedback submitted",
    "position.approved": "Position approved",
    "position.activated": "Position activated",
    "position.paused": "Position paused",
  };
  return map[action] ?? action.replace(/[_.]/g, " ");
}
