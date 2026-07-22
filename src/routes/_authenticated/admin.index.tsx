import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-overview"],
      queryFn: () => getAdminOverview(),
    }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Overview unavailable: {error.message}</div>
  ),
  component: Overview,
});

type Search = Record<string, string>;

const CARDS: Array<{
  key: keyof Awaited<ReturnType<typeof getAdminOverview>>;
  title: string;
  desc: string;
  to: string;
  search?: Search;
}> = [
  {
    key: "new_intakes",
    title: "New client intakes",
    desc: "Freshly submitted positions awaiting first triage.",
    to: "/admin/clients",
    search: { status: "submitted" } as Search,
  },
  {
    key: "positions_review",
    title: "Positions awaiting review",
    desc: "Submitted or in clarification.",
    to: "/admin/clients",
    search: { status: "submitted" } as Search,
  },
  {
    key: "candidates_review",
    title: "Candidates awaiting review",
    desc: "Scored candidates pending admin decision.",
    to: "/admin/candidates",
    search: { admin_status: "pending", processing_state: "scored" } as Search,
  },
  {
    key: "candidates_ready",
    title: "Ready to publish",
    desc: "Approved but not yet visible to the client.",
    to: "/admin/publish",
  },
  {
    key: "processing_failures",
    title: "Processing failures",
    desc: "Parse, provider, or OCR-blocked candidates.",
    to: "/admin/health",
  },
  {
    key: "client_requests",
    title: "Client requests",
    desc: "Client-initiated recompute requests (last 7d).",
    to: "/admin/candidates",
  },
  {
    key: "aging",
    title: "Aging in pipeline",
    desc: "Work in flight for more than 24h.",
    to: "/admin/health",
  },
];

function Overview() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
  });
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">What needs attention</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Snapshot at {new Date(data.generated_at).toLocaleTimeString()}. Every card opens the
          exact records behind the number.
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => {
          const n = data[c.key] as number;
          return (
            <Link
              key={c.key}
              to={c.to}
              search={c.search as never}
              className="group rounded-lg border bg-card p-5 hover:border-primary transition-colors"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">{c.title}</h2>
                <span
                  className={`text-3xl font-semibold tabular-nums ${
                    n > 0 ? "text-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {n}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{c.desc}</p>
              <p className="mt-3 text-xs font-medium text-primary group-hover:underline">
                Open records →
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
