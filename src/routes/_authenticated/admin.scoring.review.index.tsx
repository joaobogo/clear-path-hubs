import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  getReviewQueueCounts,
  REVIEW_QUEUES,
  REVIEW_SORTS,
  type ReviewQueueId,
} from "@/lib/scoring-review.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReviewTriageList } from "@/components/admin/review-triage-list";
import { Search, X } from "lucide-react";

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
        content:
          "Human quality control over parsing, evidence, eligibility and approval decisions.",
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
                      search: (p: SearchState) => ({
                        ...p,
                        q: (e.target as HTMLInputElement).value,
                        page: 1,
                      }),
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

          <ReviewTriageList
            queue={queue}
            q={search.q}
            sort={sort}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={(next) =>
              navigate({ search: (p: SearchState) => ({ ...p, page: next }) })
            }
          />
        </section>
      </div>
    </div>
  );
}
