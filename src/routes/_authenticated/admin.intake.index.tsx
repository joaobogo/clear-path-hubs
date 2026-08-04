import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState } from "react";
import { listIntakeInbox } from "@/lib/intake-admin.functions";
import { TestRecordsToggle } from "@/components/admin/TestRecordsToggle";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, ArrowRight, Inbox } from "lucide-react";

const searchSchema = z.object({
  show_test: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/admin/intake/")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ show_test: search.show_test }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin", "intake-inbox", { filter: "pending", q: "", show_test: deps.show_test }],
      queryFn: () =>
        listIntakeInbox({ data: { filter: "pending", include_test: deps.show_test } }),
    }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.intake.index.tsx"),
  head: () => ({
    meta: [
      { title: "Intake inbox · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntakeInbox,
});


type Filter = "pending" | "needs_conversion" | "approved" | "rejected" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "needs_conversion", label: "Needs conversion" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function IntakeInbox() {
  const { show_test } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [filter, setFilter] = useState<Filter>("pending");
  const [q, setQ] = useState("");
  const { data, isFetching } = useSuspenseQuery({
    queryKey: ["admin", "intake-inbox", { filter, q, show_test }],
    queryFn: () =>
      listIntakeInbox({ data: { filter, q: q || undefined, include_test: show_test } }),
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Intake inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every client brief. Convert to a position, request clarification, or reject.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {show_test
              ? "Including test and internal organizations."
              : "Test and internal organizations are hidden."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TestRecordsToggle
            checked={show_test}
            onChange={(next) => navigate({ search: { show_test: next }, replace: true })}
          />
          <div className="text-xs text-muted-foreground">
            {data.total} shown{isFetching ? " · refreshing…" : ""}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, role, email…"
          className="h-8 max-w-xs"
          aria-label="Search intake submissions"
        />
      </div>


      {data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center">
          <Inbox className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold">Inbox empty</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            No intake submissions match this filter.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Role</th>
                <th className="hidden px-3 py-2 md:table-cell">Contact</th>
                <th className="px-3 py-2">State</th>
                <th className="hidden px-3 py-2 sm:table-cell">Next action</th>
                <th className="px-3 py-2 text-right">Submitted</th>
                <th className="w-8 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((it) => (
                <tr key={it.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <Link
                      to="/admin/intake/$id"
                      params={{ id: it.id }}
                      className="font-medium hover:underline"
                    >
                      {it.company_name}
                    </Link>
                    {it.duplicate && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-warning-foreground">
                        <AlertTriangle className="h-3 w-3" /> duplicate
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{it.role_title}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">
                    {it.primary_email}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        it.status === "rejected"
                          ? "destructive"
                          : it.status === "approved"
                            ? "outline"
                            : "secondary"
                      }
                      className="capitalize"
                    >
                      {String(it.workspace_status ?? it.status).replace(/_/g, " ")}
                    </Badge>
                    {it.requisition_pending && (
                      <Badge variant="destructive" className="ml-1">
                        needs conversion
                      </Badge>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell capitalize">
                    {String(it.next_action).replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {relTime(it.created_at)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link
                      to="/admin/intake/$id"
                      params={{ id: it.id }}
                      className="inline-flex text-muted-foreground/60 hover:text-primary"
                      aria-label="Open intake"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
