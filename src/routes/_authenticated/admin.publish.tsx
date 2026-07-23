import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getPublishDeskGroups } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Ban, CheckCircle2, Eye, Pause } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/publish")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["publish-desk-groups"],
      queryFn: () => getPublishDeskGroups(),
    }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Publish desk unavailable: {error.message}</div>
  ),
  head: () => ({
    meta: [
      { title: "Publish Desk · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublishDesk,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const GROUPS = [
  {
    id: "needs_review",
    label: "Needs review",
    tone: "text-amber-800 dark:text-amber-200 bg-amber-500/10",
    icon: AlertTriangle,
    hint: "Scored candidates awaiting an admin decision.",
  },
  {
    id: "blocked",
    label: "Blocked",
    tone: "text-destructive bg-destructive/10",
    icon: Ban,
    hint: "Processing failures, provider blocks, and OCR requests.",
  },
  {
    id: "ready",
    label: "Ready to publish",
    tone: "text-emerald-800 dark:text-emerald-200 bg-emerald-500/10",
    icon: CheckCircle2,
    hint: "Approved by admin — one click to send to the client.",
  },
  {
    id: "published",
    label: "Published",
    tone: "text-primary bg-primary/10",
    icon: Eye,
    hint: "Currently live in the client workspace.",
  },
  {
    id: "held",
    label: "Held",
    tone: "text-muted-foreground bg-muted",
    icon: Pause,
    hint: "Paused pending clarification.",
  },
] as const;

type GroupId = (typeof GROUPS)[number]["id"];

function PublishDesk() {
  const { data } = useSuspenseQuery({
    queryKey: ["publish-desk-groups"],
    queryFn: () => getPublishDeskGroups(),
  });
  const buckets = data as Record<GroupId, Any[]>;

  const [group, setGroup] = useState<GroupId>(
    (GROUPS.find((g) => (buckets[g.id] ?? []).length > 0)?.id ?? "needs_review") as GroupId,
  );
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const bucket = buckets[group] ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return bucket;
    return bucket.filter((r) => {
      const name = r.candidate_profiles?.full_name?.toLowerCase() ?? "";
      const title = r.positions?.title?.toLowerCase() ?? "";
      const org = r.positions?.organizations?.name?.toLowerCase() ?? "";
      return name.includes(q) || title.includes(q) || org.includes(q);
    });
  }, [buckets, group, query]);

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Publish desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every candidate opens the full review workspace — the same one Admin uses everywhere.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-5">
        {GROUPS.map((g) => {
          const count = (buckets[g.id] ?? []).length;
          const active = group === g.id;
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              onClick={() => setGroup(g.id)}
              data-qa-action={`desk-group-${g.id}`}
              className={
                "group rounded-lg border p-3 text-left transition " +
                (active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "hover:border-muted-foreground/40")
              }
              aria-pressed={active}
            >
              <div className="flex items-center justify-between">
                <span
                  className={
                    "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium " +
                    g.tone
                  }
                >
                  <Icon className="h-3 w-3" />
                  {g.label}
                </span>
                <span className="text-lg font-semibold tabular-nums">{count}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{g.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">
            {GROUPS.find((g) => g.id === group)?.label}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({rows.length} of {(buckets[group] ?? []).length})
            </span>
          </h2>
          <Input
            placeholder="Filter by candidate, position, or client…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 max-w-xs"
          />
        </div>

        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Nothing here right now.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Candidate</th>
                <th className="px-3 py-2 font-medium">Position · Client</th>
                <th className="px-3 py-2 font-medium tabular-nums">Score</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 sr-only">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const run = r.score_runs;
                const contradiction =
                  run?.contradiction_status && run.contradiction_status !== "none";
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {r.candidate_profiles?.full_name ?? "—"}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.candidate_profiles?.email ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{r.positions?.title ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.positions?.organizations?.name ?? ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {run?.score != null ? Math.round(run.score) : "—"}
                      {contradiction && (
                        <span
                          className="ml-1 text-amber-600"
                          title={String(run.contradiction_status)}
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div>{r.processing_state.replace(/_/g, " ")}</div>
                      <div className="text-[10px] text-muted-foreground">
                        admin: {r.admin_status} · vis: {r.client_visibility}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.updated_at ? new Date(r.updated_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to="/admin/candidates/$id"
                        params={{ id: r.id }}
                        className="text-primary hover:underline"
                        data-qa-action="open-workspace"
                      >
                        Open workspace →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Prefer full search? Use <Link to="/admin/candidates" className="text-primary hover:underline">/admin/candidates</Link> —
        every workspace opens the same route as here.
      </p>
    </main>
  );
}
