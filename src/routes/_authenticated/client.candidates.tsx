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
        {(rows as AnyRow[]).map((c) => (
          <CandidateCard key={c.match_id} candidate={c} />
        ))}
        {rows.length === 0 && !isFetching && (
          <div className="rounded border bg-card p-8 text-center text-muted-foreground text-sm">
            No candidates match this view.
          </div>
        )}
      </div>
    </main>
  );
}
