import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import {
  searchCandidateMatches,
  listOrgOptions,
  listPositionOptions,
} from "@/lib/admin.functions";
import { CandidateDetailDrawer } from "@/components/candidate-detail-drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  admin_status: fallback(z.string(), "").default(""),
  processing_state: fallback(z.string(), "").default(""),
  stage: fallback(z.string(), "").default(""),
  min_score: fallback(z.string(), "").default(""),
  max_score: fallback(z.string(), "").default(""),
  client_visibility: fallback(z.string(), "").default(""),
  organization_id: fallback(z.string(), "").default(""),
  position_id: fallback(z.string(), "").default(""),
  date_from: fallback(z.string(), "").default(""),
  date_to: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "updated_desc").default("updated_desc"),
  page: fallback(z.number().int(), 1).default(1),
  open: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/admin/candidates/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Candidates · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CandidatesPage,
});

const PAGE_SIZE = 50;
const STATE_COLOR: Record<string, string> = {
  scored: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  manual_review_required: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  failed: "bg-destructive/10 text-destructive",
  provider_blocked: "bg-destructive/10 text-destructive",
  ocr_required: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function CandidatesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const searchFn = useServerFn(searchCandidateMatches);
  const orgsFn = useServerFn(listOrgOptions);
  const positionsFn = useServerFn(listPositionOptions);
  const [q, setQ] = useState(search.q ?? "");
  useEffect(() => setQ(search.q ?? ""), [search.q]);

  const filters = {
    q: search.q || undefined,
    admin_status: search.admin_status || undefined,
    processing_state: search.processing_state || undefined,
    stage: search.stage || undefined,
    client_visibility: search.client_visibility || undefined,
    organization_id: search.organization_id || undefined,
    position_id: search.position_id || undefined,
    min_score: search.min_score ? Number(search.min_score) : undefined,
    max_score: search.max_score ? Number(search.max_score) : undefined,
    date_from: search.date_from || undefined,
    date_to: search.date_to || undefined,
    sort: search.sort as
      | "updated_desc" | "updated_asc" | "score_desc" | "score_asc" | "created_desc",
    limit: PAGE_SIZE,
    offset: Math.max(0, (search.page - 1) * PAGE_SIZE),
  };

  const { data, isFetching } = useQuery({
    queryKey: ["candidate-search", filters],
    queryFn: () => searchFn({ data: filters }),
  });

  const rows = ((data && "rows" in data ? data.rows : []) as AnyRow[]) ?? [];
  const total = (data && "total" in data ? data.total : 0) ?? 0;

  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => orgsFn(),
  });
  const { data: positions = [] } = useQuery({
    queryKey: ["admin-positions-filter", search.organization_id],
    queryFn: () => positionsFn({ data: { organization_id: search.organization_id || undefined } }),
  });

  const setF = (patch: Partial<typeof search>) =>
    navigate({ search: { ...search, ...patch, page: 1 } });

  const openDrawer = (id: string) => navigate({ search: { ...search, open: id } });
  const closeDrawer = () => navigate({ search: { ...search, open: "" } });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <div className="text-sm text-muted-foreground">
          {isFetching ? "Searching…" : `${total} match${total === 1 ? "" : "es"}`}
        </div>
      </header>

      <div className="mb-3 grid grid-cols-2 md:grid-cols-6 gap-2">
        <form
          className="col-span-2"
          onSubmit={(e) => { e.preventDefault(); setF({ q }); }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" />
        </form>
        <Select value={search.organization_id || "any"} onValueChange={(v) => setF({ organization_id: v === "any" ? "" : v, position_id: "" })}>
          <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any client</SelectItem>
            {(orgs as AnyRow[]).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={search.position_id || "any"} onValueChange={(v) => setF({ position_id: v === "any" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Position" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any position</SelectItem>
            {(positions as AnyRow[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={search.stage || "any"} onValueChange={(v) => setF({ stage: v === "any" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any stage</SelectItem>
            {["new","reviewing","delivered","shortlisted","interview_process","offer","hired","not_moving_forward","archived"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.processing_state || "any"} onValueChange={(v) => setF({ processing_state: v === "any" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Parse state" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any state</SelectItem>
            {["queued","parsing","ocr_required","parsed","enriching","ready_to_score","scoring","scored","manual_review_required","provider_blocked","failed"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <Select value={search.admin_status || "any"} onValueChange={(v) => setF({ admin_status: v === "any" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Review" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any review</SelectItem>
            {["pending","approved","rejected","on_hold"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.client_visibility || "any"} onValueChange={(v) => setF({ client_visibility: v === "any" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Visibility" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any visibility</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
            <SelectItem value="visible">Client-visible</SelectItem>
          </SelectContent>
        </Select>
        <Select value={search.min_score || "any"} onValueChange={(v) => setF({ min_score: v === "any" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Min score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any min</SelectItem>
            <SelectItem value="50">≥ 50</SelectItem>
            <SelectItem value="70">≥ 70</SelectItem>
            <SelectItem value="85">≥ 85</SelectItem>
          </SelectContent>
        </Select>
        <Select value={search.max_score || "any"} onValueChange={(v) => setF({ max_score: v === "any" ? "" : v })}>
          <SelectTrigger><SelectValue placeholder="Max score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any max</SelectItem>
            <SelectItem value="49">&lt; 50</SelectItem>
            <SelectItem value="69">&lt; 70</SelectItem>
            <SelectItem value="84">&lt; 85</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={search.date_from || ""}
          onChange={(e) => setF({ date_from: e.target.value })}
          title="Updated from"
        />
        <Select value={search.sort} onValueChange={(v) => setF({ sort: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Updated ↓</SelectItem>
            <SelectItem value="updated_asc">Updated ↑</SelectItem>
            <SelectItem value="score_desc">Score ↓</SelectItem>
            <SelectItem value="score_asc">Score ↑</SelectItem>
            <SelectItem value="created_desc">Created ↓</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Position</th>
              <th className="px-3 py-2 font-medium">Applied</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Pipeline</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Fit</th>
              <th className="px-3 py-2 font-medium">Review</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const score = m.score_runs?.score;
              const fit = m.score_runs?.fit_label as string | undefined;
              const applied = m.created_at ? new Date(m.created_at) : null;
              const updated = m.updated_at ? new Date(m.updated_at) : null;
              return (
                <tr
                  key={m.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => openDrawer(m.id)}
                  data-qa-row="candidate-match"
                  data-submission-id={m.id}
                  data-application-id={m.application_id}
                  data-candidate-profile-id={m.candidate_profile_id}
                  data-position-id={m.position_id}
                  data-organization-id={m.organization_id}
                >
                  <td className="px-3 py-2 min-w-[180px]">
                    <div className="font-medium">{m.candidate_profiles?.full_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[220px]">{m.candidate_profiles?.email}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{m.positions?.organizations?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{m.positions?.title ?? "—"}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {applied ? applied.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs capitalize whitespace-nowrap">{m.stage?.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs whitespace-nowrap ${STATE_COLOR[m.processing_state] ?? "bg-muted text-muted-foreground"}`}>
                      {(m.processing_state ?? "").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-right">
                    {score == null ? "—" : score.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {fit ? fit.replace(/_/g, " ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">{m.admin_status ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{m.client_visibility ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {updated ? updated.toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      data-qa-action="open-candidate-drawer"
                      onClick={(e) => { e.stopPropagation(); openDrawer(m.id); }}
                    >
                      Open →
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !isFetching && (
              <tr>
                <td colSpan={12} className="px-3 py-16 text-center text-muted-foreground">
                  No candidates match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Page {search.page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm" variant="outline"
            disabled={search.page <= 1}
            onClick={() => navigate({ search: { ...search, page: search.page - 1 } })}
          >Prev</Button>
          <Button
            size="sm" variant="outline"
            disabled={search.page >= totalPages}
            onClick={() => navigate({ search: { ...search, page: search.page + 1 } })}
          >Next</Button>
        </div>
      </div>

      <CandidateDetailDrawer
        open={!!search.open}
        submissionId={search.open || null}
        onOpenChange={(o) => { if (!o) closeDrawer(); }}
        onSubmissionChange={(id) => openDrawer(id)}
      />
    </main>
  );
}
