import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  getClientCandidates,
  getClientContext,
  type CandidateFilter,
} from "@/lib/client.functions";
import { Input } from "@/components/ui/input";
import { CandidateCard } from "@/components/client/candidate-card";

const FILTERS: { key: CandidateFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "top", label: "Top matches" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "interview", label: "Interview process" },
  { key: "hired", label: "Hired" },
  { key: "not_moving_forward", label: "Not moving forward" },
];

const searchSchema = z.object({
  filter: fallback(z.string(), "all").default("all"),
  position: fallback(z.string(), "").default(""),
  min_score: fallback(z.string(), "").default(""),
  fit: fallback(z.string(), "").default(""),
  location: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/client/candidates")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Candidates · Client workspace" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CandidatesPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const FIT_COLOR: Record<string, string> = {
  excellent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  strong: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  moderate: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  weak: "bg-muted text-muted-foreground",
};

function CandidatesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const ctxFn = useServerFn(getClientContext);
  const listFn = useServerFn(getClientCandidates);
  const { data: ctx } = useQuery({
    queryKey: ["client-context", null],
    queryFn: () => ctxFn({ data: {} }),
  });
  const orgId = ctx?.active?.organization_id;

  const filterKey = (FILTERS.find((f) => f.key === search.filter)?.key ?? "all") as CandidateFilter;
  const minScore = search.min_score ? Number(search.min_score) : undefined;
  const { data: rows = [], refetch, isFetching } = useQuery({
    queryKey: [
      "client-candidates",
      orgId,
      filterKey,
      search.position,
      minScore,
      search.fit,
      search.location,
    ],
    queryFn: () =>
      listFn({
        data: {
          orgId: orgId!,
          filter: filterKey,
          positionId: search.position || undefined,
          minScore,
          fitBand: search.fit || undefined,
          location: search.location || undefined,
        },
      }),
    enabled: !!orgId,
  });
  useEffect(() => {
    const onRefresh = () => refetch();
    window.addEventListener("client:refresh", onRefresh);
    return () => window.removeEventListener("client:refresh", onRefresh);
  }, [refetch]);

  const setF = (patch: Partial<typeof search>) =>
    navigate({ search: { ...search, ...patch } });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <div className="text-sm text-muted-foreground">
          {isFetching ? "Loading…" : `${rows.length} candidates`}
        </div>
      </header>

      <div className="mb-3 flex flex-wrap gap-1 border-b">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            to="/client/candidates"
            search={{ ...search, filter: f.key }}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              filterKey === f.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-2">
        <Input
          placeholder="Location"
          value={search.location}
          onChange={(e) => setF({ location: e.target.value })}
        />
        <Input
          placeholder="Fit label (excellent, strong…)"
          value={search.fit}
          onChange={(e) => setF({ fit: e.target.value })}
        />
        <Input
          type="number"
          placeholder="Min score"
          value={search.min_score}
          onChange={(e) => setF({ min_score: e.target.value })}
        />
        <Input
          placeholder="Position ID (optional)"
          value={search.position}
          onChange={(e) => setF({ position: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        {(rows as AnyRow[]).map((m) => {
          const cov = m.score_runs?.requirement_coverage as AnyRow | null;
          const strongest =
            cov?.strongest?.label ??
            cov?.top_match?.label ??
            (Array.isArray(cov?.matched) ? cov.matched[0] : null);
          const gap =
            cov?.main_consideration ??
            cov?.gap ??
            (Array.isArray(cov?.missing) ? cov.missing[0] : null);
          return (
            <div key={m.id} className="rounded-lg border bg-card p-4 hover:border-primary transition">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">
                      {m.candidate_profiles?.full_name ?? "Candidate"}
                    </div>
                    {m.approved_fit_label && (
                      <span
                        className={`text-xs rounded px-2 py-0.5 capitalize ${
                          FIT_COLOR[m.approved_fit_label] ?? "bg-muted"
                        }`}
                      >
                        {m.approved_fit_label}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {String(m.stage).replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {m.positions?.title} ·{" "}
                    {m.candidate_profiles?.location ?? "—"}
                  </div>
                  <div className="text-xs mt-2 space-y-0.5">
                    {strongest && (
                      <div>
                        <span className="text-muted-foreground">Strongest match: </span>
                        {String(strongest)}
                      </div>
                    )}
                    {gap && (
                      <div>
                        <span className="text-muted-foreground">Main consideration: </span>
                        {String(gap)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Score
                    </div>
                    <div className="text-xl font-semibold tabular-nums">
                      {m.approved_score == null ? "—" : m.approved_score.toFixed(0)}
                    </div>
                  </div>
                  <Link
                    to="/client/candidates/$id"
                    params={{ id: m.id }}
                    className="text-sm text-primary hover:underline"
                  >
                    Review →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && !isFetching && (
          <div className="rounded border bg-card p-8 text-center text-muted-foreground text-sm">
            No candidates match this view.
          </div>
        )}
      </div>
    </main>
  );
}
