import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-overview"],
      queryFn: () => getAdminOverview(),
    }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Overview unavailable: {error.message}</div>
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
type AnyRow = any;

type CardKey =
  | "new_intakes"
  | "positions_review"
  | "new_applications"
  | "candidates_review"
  | "candidates_ready"
  | "processing_failures"
  | "client_requests";

type Card = {
  key: CardKey;
  title: string;
  desc: string;
  to: string;
  search?: Record<string, string>;
  icon: typeof Inbox;
};

const CARDS: Card[] = [
  {
    key: "new_intakes",
    title: "New intakes",
    desc: "Client briefs submitted in the last 7 days.",
    to: "/admin/positions",
    search: { status: "submitted" },
    icon: Inbox,
  },
  {
    key: "positions_review",
    title: "Positions awaiting review",
    desc: "Submitted or in clarification — needs approval.",
    to: "/admin/positions",
    search: { status: "submitted" },
    icon: Briefcase,
  },
  {
    key: "new_applications",
    title: "New applications (24h)",
    desc: "Candidate submissions flowing through the pipeline.",
    to: "/admin/candidates",
    icon: UserPlus,
  },
  {
    key: "candidates_review",
    title: "Candidates awaiting review",
    desc: "Scored candidates pending admin decision.",
    to: "/admin/candidates",
    search: { admin_status: "pending", processing_state: "scored" },
    icon: ClipboardCheck,
  },
  {
    key: "candidates_ready",
    title: "Ready to publish",
    desc: "Approved but not yet visible to the client.",
    to: "/admin/publish",
    icon: Send,
  },
  {
    key: "processing_failures",
    title: "Processing problems",
    desc: "Parse, provider, OCR, or manual-review incidents.",
    to: "/admin/operations",
    icon: AlertOctagon,
  },
  {
    key: "client_requests",
    title: "Client actions (7d)",
    desc: "Recompute requests and feedback from clients.",
    to: "/admin/candidates",
    icon: MessagesSquare,
  },
];

function Overview() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
  });

  const pendingReview = data.action_items.candidates_pending_review;
  const readyPublish = data.action_items.candidates_ready_to_publish;
  const positionsAwaiting = data.action_items.positions_awaiting_approval;
  const anyAction =
    pendingReview.length > 0 || readyPublish.length > 0 || positionsAwaiting.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Snapshot at {new Date(data.generated_at).toLocaleTimeString()}. Every card and row
          opens the exact record behind the number.
        </p>
      </header>

      {/* ── Prioritized cards ─────────────────────────────────────────────── */}
      <section aria-label="Priorities">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {CARDS.map((c) => {
            const n = data[c.key] as number;
            const Icon = c.icon;
            return (
              <Link
                key={c.key}
                to={c.to}
                search={c.search as never}
                className="group rounded-lg border bg-card p-5 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span
                    className={`text-3xl font-semibold tabular-nums ${
                      n > 0 ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  >
                    {n}
                  </span>
                </div>
                <h2 className="mt-2 text-sm font-medium">{c.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.desc}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
                  Open records <ArrowRight className="h-3 w-3" />
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Action Required ───────────────────────────────────────────────── */}
      <section aria-label="Action required" className="rounded-lg border bg-card">
        <header className="px-5 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Action required</h2>
            <p className="text-xs text-muted-foreground">
              The highest-priority records waiting on you right now.
            </p>
          </div>
          {!anyAction && <Badge variant="outline">All clear</Badge>}
        </header>
        {anyAction ? (
          <ul className="divide-y">
            {positionsAwaiting.map((p: AnyRow) => (
              <li key={p.id}>
                <Link
                  to="/admin/positions/$id"
                  params={{ id: p.id }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
                >
                  <Briefcase className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      Approve position — {p.title}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.organizations?.name} · submitted {relTime(p.created_at)}
                    </div>
                  </div>
                  <Badge variant="secondary">{p.status.replace(/_/g, " ")}</Badge>
                </Link>
              </li>
            ))}
            {pendingReview.map((m: AnyRow) => (
              <li key={m.id}>
                <Link
                  to="/admin/candidates/$id"
                  params={{ id: m.id }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
                >
                  <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      Review candidate — {m.candidate_profiles?.full_name ?? "Candidate"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.positions?.title} · {m.positions?.organizations?.name}
                    </div>
                  </div>
                  {m.score_runs?.score != null && (
                    <Badge>{Math.round(m.score_runs.score)}</Badge>
                  )}
                </Link>
              </li>
            ))}
            {readyPublish.map((m: AnyRow) => (
              <li key={m.id}>
                <Link
                  to="/admin/publish"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
                >
                  <Send className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      Publish to client — {m.candidate_profiles?.full_name ?? "Candidate"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.positions?.title} · {m.positions?.organizations?.name}
                    </div>
                  </div>
                  <Badge variant="outline">approved</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-sm text-muted-foreground text-center">
            Nothing to action right now — the queue is empty.
          </div>
        )}
      </section>

      {/* ── Recent activity ───────────────────────────────────────────────── */}
      <section aria-label="Recent activity" className="rounded-lg border bg-card">
        <header className="px-5 py-3 border-b flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Recent activity</h2>
        </header>
        {data.recent_activity.length === 0 ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">No activity yet.</div>
        ) : (
          <ul className="divide-y text-sm">
            {data.recent_activity.map((a: AnyRow) => (
              <li key={a.id} className="px-5 py-2 flex items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums w-16 shrink-0">
                  {relTime(a.created_at)}
                </span>
                <span className="font-medium capitalize">
                  {a.action.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted-foreground">{a.entity_type}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
