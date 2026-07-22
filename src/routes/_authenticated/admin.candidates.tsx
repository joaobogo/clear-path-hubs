import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { z } from "zod";
import { searchCandidateMatches } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({
  q: z.string().optional(),
  admin_status: z.string().optional(),
  processing_state: z.string().optional(),
  stage: z.string().optional(),
  min_score: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/candidates")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Candidates · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CandidatesPage,
});

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
  const [q, setQ] = useState(search.q ?? "");

  useEffect(() => setQ(search.q ?? ""), [search.q]);

  const filters = {
    q: search.q,
    admin_status: search.admin_status,
    processing_state: search.processing_state,
    stage: search.stage,
    min_score: search.min_score ? Number(search.min_score) : undefined,
  };

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ["candidate-search", filters],
    queryFn: () => searchFn({ data: filters }),
  });

  const setF = (k: string, v: string | undefined) =>
    navigate({ search: { ...search, [k]: v || undefined } });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <div className="text-sm text-muted-foreground">
          {isFetching ? "Searching…" : `${rows.length} matches`}
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <form
          className="col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            setF("q", q);
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or email"
          />
        </form>
        <Select
          value={search.stage ?? "any"}
          onValueChange={(v) => setF("stage", v === "any" ? undefined : v)}
        >
          <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any stage</SelectItem>
            {["new", "reviewing", "delivered", "shortlisted", "interview_process", "offer", "hired", "not_moving_forward", "archived"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.admin_status ?? "any"}
          onValueChange={(v) => setF("admin_status", v === "any" ? undefined : v)}
        >
          <SelectTrigger><SelectValue placeholder="Review" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any review</SelectItem>
            {["pending", "approved", "rejected", "on_hold"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.processing_state ?? "any"}
          onValueChange={(v) => setF("processing_state", v === "any" ? undefined : v)}
        >
          <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any state</SelectItem>
            {["queued", "parsing", "ocr_required", "parsed", "enriching", "ready_to_score", "scoring", "scored", "manual_review_required", "provider_blocked", "failed"].map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.min_score ?? "any"}
          onValueChange={(v) => setF("min_score", v === "any" ? undefined : v)}
        >
          <SelectTrigger><SelectValue placeholder="Min score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any score</SelectItem>
            <SelectItem value="50">≥ 50</SelectItem>
            <SelectItem value="70">≥ 70</SelectItem>
            <SelectItem value="85">≥ 85</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Review</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(rows as AnyRow[]).map((m) => (
              <tr key={m.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{m.candidate_profiles?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{m.candidate_profiles?.email}</div>
                </td>
                <td className="px-3 py-2">
                  <div>{m.positions?.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.positions?.organizations?.name}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs ${
                      STATE_COLOR[m.processing_state] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {m.processing_state.replace(/_/g, " ")}
                  </span>
                  {m.score_runs?.contradiction_status &&
                    m.score_runs.contradiction_status !== "none" && (
                      <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        ⚠ {m.score_runs.contradiction_status.replace(/_/g, " ")}
                      </div>
                    )}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {m.score_runs?.score == null ? "—" : m.score_runs.score.toFixed(1)}
                </td>
                <td className="px-3 py-2 capitalize">{m.stage.replace(/_/g, " ")}</td>
                <td className="px-3 py-2 capitalize">{m.admin_status}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/admin/candidates/$id"
                    params={{ id: m.id }}
                    className="text-primary hover:underline"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !isFetching && (
              <tr>
                <td colSpan={7} className="px-3 py-16 text-center text-muted-foreground">
                  No candidates match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
