import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getWbrReport,
  getWbrCommitments,
  saveWbrCommitments,
} from "@/lib/wbr.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Download,
  Printer,
  Share2,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const Route = createFileRoute("/_authenticated/admin/wbr")({
  validateSearch: (raw: Record<string, unknown>) => ({
    weeks_back: Number(raw.weeks_back ?? 0) || 0,
  }),
  loaderDeps: ({ search }) => ({ weeks_back: search.weeks_back }),
  loader: async ({ context, deps }) => {
    const report = await context.queryClient.ensureQueryData({
      queryKey: ["wbr-report", deps.weeks_back],
      queryFn: () => getWbrReport({ data: { weeks_back: deps.weeks_back } }),
    });
    const commitments = await context.queryClient.ensureQueryData({
      queryKey: ["wbr-commitments", report.week_start],
      queryFn: () =>
        getWbrCommitments({ data: { week_start: report.week_start } }),
    });
    return { report, commitments };
  },
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.wbr.tsx"),
  head: () => ({
    meta: [
      { title: "Weekly Business Review · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WbrPage,
});

function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(new Date(endIso).getTime() - 1);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
}

function Delta({ current, prev }: { current: number; prev: number }) {
  const diff = current - prev;
  const pct = prev === 0 ? (current > 0 ? 100 : 0) : Math.round((diff / prev) * 100);
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const tone =
    diff > 0
      ? "text-success"
      : diff < 0
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${tone}`}>
      <Icon className="h-3 w-3" />
      {diff > 0 ? "+" : ""}
      {diff} · {pct}%
    </span>
  );
}

function Kpi({
  label,
  value,
  prev,
  hint,
}: {
  label: string;
  value: number;
  prev?: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <div className="text-3xl font-semibold tabular-nums">{value}</div>
        {prev != null && <Delta current={value} prev={prev} />}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function WbrPage() {
  const { report, commitments } = Route.useLoaderData() as Any;
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const saveFn = useServerFn(saveWbrCommitments);

  const [items, setItems] = useState<{ title: string; owner?: string; due?: string }[]>(
    () => (commitments?.commitments?.length ? commitments.commitments : [{ title: "" }]),
  );

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          week_start: report.week_start,
          commitments: items.filter((i) => i.title.trim().length >= 3),
        },
      }),
    onSuccess: (r: Any) => {
      toast.success(`Saved ${r.saved} commitment${r.saved === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["wbr-commitments", report.week_start] });
    },
    onError: (e: Any) => toast.error(e?.message ?? "Save failed"),
  });

  const csv = useMemo(() => buildCsv(report), [report]);

  const downloadCsv = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taasflow-wbr-${report.week_start.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareLink = () => {
    const link = `${window.location.origin}/admin/wbr?weeks_back=${search.weeks_back}`;
    navigator.clipboard.writeText(link).then(
      () => toast.success("Share link copied"),
      () => toast.error("Copy failed"),
    );
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-end md:justify-between print:border-b-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Weekly Operating Review
          </div>
          <h1 className="mt-1 font-serif text-3xl">
            {fmtRange(report.week_start, report.week_end)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshot generated {new Date(report.generated_at).toLocaleString()}.
            Same metrics we walk clients through.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({ search: { weeks_back: search.weeks_back + 1 } })
            }
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={search.weeks_back === 0}
            onClick={() =>
              navigate({
                search: { weeks_back: Math.max(0, search.weeks_back - 1) },
              })
            }
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              qc.invalidateQueries({ queryKey: ["wbr-report", search.weeks_back] })
            }
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            Print / PDF
          </Button>
          <Button variant="outline" size="sm" onClick={shareLink}>
            <Share2 className="mr-1 h-4 w-4" />
            Share
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Roles opened"
          value={report.totals.roles_opened}
          prev={report.totals.roles_opened_prev}
          hint="New positions created this week"
        />
        <Kpi
          label="Candidates delivered"
          value={report.totals.candidates_delivered}
          prev={report.totals.candidates_delivered_prev}
          hint="Made visible in client workspace"
        />
        <Kpi
          label="Interviews scheduled"
          value={report.totals.interviews_scheduled}
          prev={report.totals.interviews_scheduled_prev}
          hint="New interview slots recorded"
        />
        <Kpi
          label="Approvals stuck"
          value={report.totals.approvals_stuck}
          hint="Scored & pending > 48h"
        />
      </section>

      {/* Bottlenecks + Source effectiveness */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Bottlenecks (in-flight &gt; 24h)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Where the pipeline is sitting. Zero across the board is the goal.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {report.bottlenecks
              .filter((b: Any) => b.count > 0)
              .sort((a: Any, b: Any) => b.count - a.count)
              .map((b: Any) => (
                <li
                  key={b.state}
                  className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2"
                >
                  <span className="capitalize">{b.state.replace(/_/g, " ")}</span>
                  <Badge variant={b.count > 5 ? "destructive" : "secondary"}>
                    {b.count}
                  </Badge>
                </li>
              ))}
            {report.bottlenecks.every((b: Any) => b.count === 0) && (
              <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                No aged work. Pipeline is clear.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-semibold">Source effectiveness</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Applications received this week and how far they got.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 text-left font-medium">Source</th>
                  <th className="pb-2 text-right font-medium">Received</th>
                  <th className="pb-2 text-right font-medium">Evaluated</th>
                  <th className="pb-2 text-right font-medium">Delivered</th>
                  <th className="pb-2 text-right font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.source_effectiveness.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                      No applications received this week.
                    </td>
                  </tr>
                )}
                {report.source_effectiveness.map((r: Any) => (
                  <tr key={r.source}>
                    <td className="py-1.5 capitalize">{r.source.replace(/_/g, " ")}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.total}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.scored}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.delivered}</td>
                    <td className="py-1.5 text-right tabular-nums">{r.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top open positions */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Active positions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Where we're deploying capacity right now.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2 text-left font-medium">Role</th>
                <th className="pb-2 text-left font-medium">Client</th>
                <th className="pb-2 text-right font-medium">Candidates</th>
                <th className="pb-2 text-right font-medium">Delivered</th>
                <th className="pb-2 text-right font-medium">Pending</th>
                <th className="pb-2 text-right font-medium print:hidden"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.top_open_positions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                    No active positions.
                  </td>
                </tr>
              )}
              {report.top_open_positions.map((p: Any) => (
                <tr key={p.id}>
                  <td className="py-1.5 font-medium">{p.title}</td>
                  <td className="py-1.5 text-muted-foreground">{p.organization ?? "—"}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.total_candidates}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.delivered}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.pending}</td>
                  <td className="py-1.5 text-right print:hidden">
                    <Link
                      to="/admin/positions/$id"
                      params={{ id: p.id }}
                      className="text-primary hover:underline"
                    >
                      Open <ArrowRight className="inline h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Client requests */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Client requests this week</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {report.client_requests.length === 0 && (
            <li className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              No re-evaluation requests logged.
            </li>
          )}
          {report.client_requests.map((r: Any) => (
            <li
              key={r.id}
              className="rounded-md border bg-background/60 p-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-medium">
                  {r.candidate_matches?.candidate_profiles?.full_name ?? "Unknown"}
                  <span className="ml-2 text-xs text-muted-foreground">
                    for {r.candidate_matches?.positions?.title ?? "—"}
                    {r.candidate_matches?.positions?.organizations?.name
                      ? ` · ${r.candidate_matches.positions.organizations.name}`
                      : ""}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              {r.reason && (
                <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Next week commitments */}
      <section className="rounded-lg border bg-card p-4 print:break-inside-avoid">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-semibold">Next week commitments</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              What we're on the hook for. Reviewed at next week's WBR.
            </p>
          </div>
          {commitments?.recorded_at && (
            <span className="text-xs text-muted-foreground">
              Last saved {new Date(commitments.recorded_at).toLocaleString()}
            </span>
          )}
        </div>
        <div className="mt-3 space-y-2 print:mt-2">
          {items.map((c, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[1fr_180px_140px_auto]">
              <Input
                placeholder="Commitment"
                value={c.title}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], title: e.target.value };
                  setItems(next);
                }}
              />
              <Input
                placeholder="Owner"
                value={c.owner ?? ""}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], owner: e.target.value };
                  setItems(next);
                }}
              />
              <Input
                placeholder="Due (e.g. Fri)"
                value={c.due ?? ""}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], due: e.target.value };
                  setItems(next);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="print:hidden"
                onClick={() => setItems(items.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems([...items, { title: "" }])}
          >
            Add commitment
          </Button>
          <Button
            size="sm"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save commitments"}
          </Button>
        </div>
      </section>

      <footer className="pt-2 text-xs text-muted-foreground print:pt-4">
        Prepared by TaaSFlow operating team · figures reconcile with the admin
        overview and delivery queue.
      </footer>
    </div>
  );
}

function buildCsv(report: Any): string {
  const rows: string[][] = [];
  rows.push(["Section", "Metric", "Value", "Prev", "Note"]);
  rows.push([
    "Totals",
    "Roles opened",
    String(report.totals.roles_opened),
    String(report.totals.roles_opened_prev),
    "",
  ]);
  rows.push([
    "Totals",
    "Candidates delivered",
    String(report.totals.candidates_delivered),
    String(report.totals.candidates_delivered_prev),
    "",
  ]);
  rows.push([
    "Totals",
    "Interviews scheduled",
    String(report.totals.interviews_scheduled),
    String(report.totals.interviews_scheduled_prev),
    "",
  ]);
  rows.push([
    "Totals",
    "Approvals stuck",
    String(report.totals.approvals_stuck),
    "",
    "> 48h scored & pending",
  ]);
  for (const b of report.bottlenecks) {
    rows.push(["Bottlenecks", b.state, String(b.count), "", "aged > 24h"]);
  }
  for (const s of report.source_effectiveness) {
    rows.push([
      "Source",
      s.source,
      String(s.total),
      "",
      `evaluated ${s.scored}, delivered ${s.delivered}, conv ${s.conversion}%`,
    ]);
  }
  for (const p of report.top_open_positions) {
    rows.push([
      "Position",
      p.title,
      String(p.total_candidates),
      "",
      `${p.organization ?? ""} · delivered ${p.delivered} · pending ${p.pending}`,
    ]);
  }
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
