import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight } from "lucide-react";

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  admin_status: fallback(z.string(), "").default(""),
  processing_state: fallback(z.string(), "").default(""),
  fit: fallback(z.string(), "").default(""),
  client_visibility: fallback(z.string(), "").default(""),
  organization_id: fallback(z.string(), "").default(""),
  position_id: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "updated_desc").default("updated_desc"),
  page: fallback(z.number().int(), 1).default(1),
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

const STATE_TONE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  parsing: "bg-info/10 text-info dark:text-info",
  enriching: "bg-info/10 text-info dark:text-info",
  ready_to_score: "bg-info/10 text-info dark:text-info",
  scoring: "bg-info/10 text-info dark:text-info",
  scored: "bg-success/10 text-success dark:text-success",
  manual_review_required: "bg-warning/10 text-warning-foreground dark:text-warning-foreground",
  ocr_required: "bg-warning/10 text-warning-foreground dark:text-warning-foreground",
  failed: "bg-destructive/10 text-destructive",
  provider_blocked: "bg-destructive/10 text-destructive",
};

const REVIEW_TONE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success dark:text-success",
  rejected: "bg-destructive/10 text-destructive",
  on_hold: "bg-warning/10 text-warning-foreground dark:text-warning-foreground",
};

const FIT_TONE: Record<string, string> = {
  strong_match: "bg-success/10 text-success dark:text-success",
  good_match: "bg-success/10 text-success dark:text-success",
  potential_match: "bg-warning/10 text-warning-foreground dark:text-warning-foreground",
  partial_match: "bg-warning/10 text-warning-foreground dark:text-warning-foreground",
  weak_match: "bg-muted text-muted-foreground",
  poor_match: "bg-destructive/10 text-destructive",
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
    client_visibility: search.client_visibility || undefined,
    organization_id: search.organization_id || undefined,
    position_id: search.position_id || undefined,
    sort: search.sort as
      | "updated_desc"
      | "updated_asc"
      | "score_desc"
      | "score_asc"
      | "created_desc",
    limit: PAGE_SIZE,
    offset: Math.max(0, (search.page - 1) * PAGE_SIZE),
  };

  const { data, isFetching } = useQuery({
    queryKey: ["candidate-search", filters],
    queryFn: () => searchFn({ data: filters }),
  });

  let rows = ((data && "rows" in data ? data.rows : []) as AnyRow[]) ?? [];
  const total = (data && "total" in data ? data.total : 0) ?? 0;

  // Fit filter applied client-side (score run join carries fit_label).
  if (search.fit) {
    rows = rows.filter((r) => (r.score_runs?.fit_label ?? "") === search.fit);
  }

  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => orgsFn(),
  });
  const { data: positions = [] } = useQuery({
    queryKey: ["admin-positions-filter", search.organization_id],
    queryFn: () =>
      positionsFn({
        data: { organization_id: search.organization_id || undefined },
      }),
  });

  const setF = (patch: Partial<typeof search>) =>
    navigate({ search: { ...search, ...patch, page: 1 } });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every row opens the exact candidate submission — repair actions live inside the workspace.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {isFetching ? "Searching…" : `${total} match${total === 1 ? "" : "es"}`}
        </div>
      </header>

      {/* Filter row 1 */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        <form
          className="col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            setF({ q });
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or email"
            aria-label="Search candidates by name or email"
          />
        </form>
        <Select
          value={search.organization_id || "any"}
          onValueChange={(v) =>
            setF({ organization_id: v === "any" ? "" : v, position_id: "" })
          }
        >
          <SelectTrigger aria-label="Filter by client"><SelectValue placeholder="Client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any client</SelectItem>
            {(orgs as AnyRow[]).map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.position_id || "any"}
          onValueChange={(v) => setF({ position_id: v === "any" ? "" : v })}
        >
          <SelectTrigger aria-label="Filter by position"><SelectValue placeholder="Position" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any position</SelectItem>
            {(positions as AnyRow[]).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.processing_state || "any"}
          onValueChange={(v) => setF({ processing_state: v === "any" ? "" : v })}
        >
          <SelectTrigger aria-label="Filter by processing state"><SelectValue placeholder="Processing" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any processing</SelectItem>
            {[
              "queued","parsing","ocr_required","parsed","enriching",
              "ready_to_score","scoring","scored",
              "manual_review_required","provider_blocked","failed",
            ].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter row 2 */}
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Select
          value={search.fit || "any"}
          onValueChange={(v) => setF({ fit: v === "any" ? "" : v })}
        >
          <SelectTrigger aria-label="Filter by fit band"><SelectValue placeholder="Fit band" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any fit</SelectItem>
            <SelectItem value="strong_match">Strong match</SelectItem>
            <SelectItem value="good_match">Good match</SelectItem>
            <SelectItem value="potential_match">Potential match</SelectItem>
            <SelectItem value="partial_match">Partial match</SelectItem>
            <SelectItem value="weak_match">Weak match</SelectItem>
            <SelectItem value="poor_match">Poor match</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={search.admin_status || "any"}
          onValueChange={(v) => setF({ admin_status: v === "any" ? "" : v })}
        >
          <SelectTrigger aria-label="Filter by review state"><SelectValue placeholder="Review" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any review</SelectItem>
            {["pending", "approved", "rejected", "on_hold"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.client_visibility || "any"}
          onValueChange={(v) => setF({ client_visibility: v === "any" ? "" : v })}
        >
          <SelectTrigger aria-label="Filter by publication state"><SelectValue placeholder="Publication" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any publication</SelectItem>
            <SelectItem value="hidden">Not published</SelectItem>
            <SelectItem value="visible">Published to client</SelectItem>
          </SelectContent>
        </Select>
        <Select value={search.sort} onValueChange={(v) => setF({ sort: v })}>
          <SelectTrigger aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated_desc">Latest update ↓</SelectItem>
            <SelectItem value="updated_asc">Latest update ↑</SelectItem>
            <SelectItem value="score_desc">Approved score ↓</SelectItem>
            <SelectItem value="score_asc">Approved score ↑</SelectItem>
            <SelectItem value="created_desc">Submitted ↓</SelectItem>
          </SelectContent>
        </Select>
        <div className="col-span-2 flex items-center justify-end">
          {(search.q ||
            search.organization_id ||
            search.position_id ||
            search.processing_state ||
            search.admin_status ||
            search.client_visibility ||
            search.fit) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                navigate({
                  search: {
                    q: "",
                    admin_status: "",
                    processing_state: "",
                    fit: "",
                    client_visibility: "",
                    organization_id: "",
                    position_id: "",
                    sort: "updated_desc",
                    page: 1,
                  },
                })
              }
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Position</th>
              <th className="px-3 py-2 font-medium">Processing</th>
              <th className="px-3 py-2 font-medium text-right">Score</th>
              <th className="px-3 py-2 font-medium">Fit</th>
              <th className="px-3 py-2 font-medium">Review</th>
              <th className="px-3 py-2 font-medium">Publication</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const score = m.score_runs?.score;
              const fit = m.score_runs?.fit_label as string | undefined;
              const updated = m.updated_at ? new Date(m.updated_at) : null;
              const pubLabel = m.client_visibility === "visible" ? "Published" : "Not published";
              return (
                <tr
                  key={m.id}
                  className="border-t hover:bg-muted/30"
                  data-qa-row="candidate-match"
                  data-submission-id={m.id}
                  data-application-id={m.application_id}
                  data-candidate-profile-id={m.candidate_profile_id}
                  data-position-id={m.position_id}
                  data-organization-id={m.organization_id}
                >
                  <td className="min-w-[180px] px-3 py-2">
                    <Link
                      to="/admin/candidates/$id"
                      params={{ id: m.id }}
                      className="block hover:underline"
                    >
                      <div className="font-medium">
                        {m.candidate_profiles?.full_name ?? "Unnamed candidate"}
                      </div>
                      <div className="truncate max-w-[220px] text-xs text-muted-foreground">
                        {m.candidate_profiles?.email}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {m.positions?.organizations?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <Link
                      to="/admin/positions/$id"
                      params={{ id: m.position_id }}
                      className="hover:underline"
                    >
                      {m.positions?.title ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                        STATE_TONE[m.processing_state] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {(m.processing_state ?? "").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {score == null ? "—" : Math.round(score)}
                  </td>
                  <td className="px-3 py-2">
                    {fit ? (
                      <Badge
                        variant="outline"
                        className={`whitespace-nowrap text-xs ${FIT_TONE[fit] ?? ""}`}
                      >
                        {fit.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${
                        REVIEW_TONE[m.admin_status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {(m.admin_status ?? "pending").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={m.client_visibility === "visible" ? "default" : "outline"}
                      className="whitespace-nowrap text-xs"
                    >
                      {pubLabel}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {updated ? updated.toLocaleDateString() : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      data-qa-action="open-candidate"
                    >
                      <Link to="/admin/candidates/$id" params={{ id: m.id }}>
                        Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !isFetching && (
              <tr>
                <td colSpan={10} className="px-3 py-16 text-center text-muted-foreground">
                  No candidates match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((m) => {
          const score = m.score_runs?.score;
          const fit = m.score_runs?.fit_label as string | undefined;
          return (
            <li
              key={m.id}
              className="rounded-lg border bg-card p-3"
              data-qa-row="candidate-match"
              data-submission-id={m.id}
            >
              <Link
                to="/admin/candidates/$id"
                params={{ id: m.id }}
                className="block"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {m.candidate_profiles?.full_name ?? "Unnamed candidate"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.positions?.organizations?.name} · {m.positions?.title}
                    </div>
                  </div>
                  <div className="tabular-nums text-right text-sm font-semibold">
                    {score == null ? "—" : Math.round(score)}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span
                    className={`rounded px-2 py-0.5 ${
                      STATE_TONE[m.processing_state] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {(m.processing_state ?? "").replace(/_/g, " ")}
                  </span>
                  {fit && (
                    <span className={`rounded px-2 py-0.5 ${FIT_TONE[fit] ?? "bg-muted"}`}>
                      {fit.replace(/_/g, " ")}
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 ${
                      REVIEW_TONE[m.admin_status] ?? "bg-muted"
                    }`}
                  >
                    {(m.admin_status ?? "pending").replace(/_/g, " ")}
                  </span>
                  <span className="rounded border px-2 py-0.5">
                    {m.client_visibility === "visible" ? "Published" : "Not published"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && !isFetching && (
          <li className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
            No candidates match your filters.
          </li>
        )}
      </ul>

      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          Page {search.page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={search.page <= 1}
            onClick={() =>
              navigate({ search: { ...search, page: search.page - 1 } })
            }
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={search.page >= totalPages}
            onClick={() =>
              navigate({ search: { ...search, page: search.page + 1 } })
            }
          >
            Next
          </Button>
        </div>
      </div>
    </main>
  );
}
