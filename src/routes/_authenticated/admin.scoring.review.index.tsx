import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import {
  getReviewQueueCounts,
  listReviewQueue,
  REVIEW_QUEUES,
  REVIEW_SORTS,
  type ReviewQueueId,
} from "@/lib/scoring-review.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { AlertTriangle, ArrowRight, Search, X } from "lucide-react";

const QUEUE_ORDER = Object.keys(REVIEW_QUEUES) as ReviewQueueId[];

const searchSchema = z.object({
  queue: fallback(z.string(), "ready_for_decision").default("ready_for_decision"),
  q: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "oldest_first").default("oldest_first"),
  page: fallback(z.number().int(), 1).default(1),
});

type SearchState = z.infer<typeof searchSchema>;

const PAGE_SIZE = 25;

export const Route = createFileRoute("/_authenticated/admin/scoring/review/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Scoring review center · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Human quality control over parsing, evidence, eligibility and approval decisions.",
      },
    ],
  }),
  component: ReviewCenter,
});

function safeQueue(v: string): ReviewQueueId {
  return (QUEUE_ORDER as string[]).includes(v) ? (v as ReviewQueueId) : "ready_for_decision";
}
function safeSort(v: string) {
  return (REVIEW_SORTS as readonly string[]).includes(v)
    ? (v as (typeof REVIEW_SORTS)[number])
    : "oldest_first";
}

function ReviewCenter() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queue = safeQueue(search.queue);
  const sort = safeSort(search.sort);
  const page = Math.max(1, search.page);

  const counts = useSuspenseQuery({
    queryKey: ["review-queue-counts"],
    queryFn: () => getReviewQueueCounts(),
  });

  const list = useQuery({
    queryKey: ["review-queue", queue, search.q, sort, page],
    queryFn: () =>
      listReviewQueue({
        data: {
          queue,
          q: search.q || undefined,
          sort,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        },
      }),
  });

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Scoring review center</h1>
        <p className="text-sm text-muted-foreground">
          Every submission that needs a human decision before it reaches a client.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Review queues" className="space-y-1">
          {QUEUE_ORDER.map((id) => {
            const meta = REVIEW_QUEUES[id];
            const count = counts.data?.[id] ?? 0;
            const active = id === queue;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  navigate({ search: (p: SearchState) => ({ ...p, queue: id, page: 1 }) })
                }
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  active
                    ? "border-primary/40 bg-primary/10 font-medium"
                    : "border-transparent hover:bg-muted/60"
                }`}
              >
                <span className="space-y-0.5">
                  <span className="block">{meta.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {meta.hint}
                  </span>
                </span>
                <Badge variant={count > 0 ? "default" : "secondary"} className="shrink-0">
                  {count}
                </Badge>
              </button>
            );
          })}
        </nav>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search candidates, jobs or clients"
                placeholder="Search candidate, job or client…"
                defaultValue={search.q}
                className="pl-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    navigate({
                      search: (p: SearchState) => ({ ...p, q: (e.target as HTMLInputElement).value, page: 1 }),
                    });
                  }
                }}
              />
            </div>
            <select
              aria-label="Sort"
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={sort}
              onChange={(e) =>
                navigate({ search: (p: SearchState) => ({ ...p, sort: e.target.value, page: 1 }) })
              }
            >
              <option value="oldest_first">Oldest waiting first</option>
              <option value="newest_first">Newest first</option>
              <option value="score_desc">Score, high to low</option>
              <option value="score_asc">Score, low to high</option>
              <option value="confidence_asc">Lowest confidence first</option>
            </select>
            {search.q ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ search: (p: SearchState) => ({ ...p, q: "", page: 1 }) })}
              >
                <X className="mr-1 size-3.5" /> Clear search
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            {list.isPending ? "Loading…" : `${total} in ${REVIEW_QUEUES[queue].label.toLowerCase()}`}
          </p>

          {!list.isPending && rows.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Nothing waiting in this queue.
            </Card>
          ) : null}

          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.match_id}>
                <Link
                  to="/admin/scoring/review/$matchId"
                  params={{ matchId: r.match_id }}
                  search={{ queue, q: search.q, sort, page }}
                  className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition hover:border-primary/40 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.full_name ?? "Unnamed candidate"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.position_title ?? "—"} · {r.org_name ?? "—"}
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
                    {r.missing_critical_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="size-3.5" />
                        {r.missing_critical_count} missing
                      </span>
                    ) : null}
                    {r.contradictory_count > 0 ? (
                      <span className="text-destructive">{r.contradictory_count} conflict</span>
                    ) : null}
                    <span>
                      conf{" "}
                      {r.evidence_confidence != null
                        ? Number(r.evidence_confidence).toFixed(2)
                        : "—"}
                    </span>
                    <Badge variant="secondary">
                      {r.final_score ?? r.score ?? "—"}
                    </Badge>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => navigate({ search: (p: SearchState) => ({ ...p, page: page - 1 }) })}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => navigate({ search: (p: SearchState) => ({ ...p, page: page + 1 }) })}
              >
                Next
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
