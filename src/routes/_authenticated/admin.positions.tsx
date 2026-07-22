import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { listPositions } from "@/lib/admin.functions";
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
  status: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/positions")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Positions · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Review, edit, and approve positions across all client organizations.",
      },
    ],
  }),
  component: PositionsPage,
});

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  needs_clarification: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  paused: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

function PositionsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const list = useServerFn(listPositions);
  const [q, setQ] = useState(search.q ?? "");
  const status = search.status ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "positions", { q: search.q ?? "", status }],
    queryFn: () =>
      list({
        data: {
          q: search.q || undefined,
          status: status || undefined,
        },
      }),
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} position{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ search: (s: Record<string, unknown>) => ({ ...s, q: q || undefined }) });
            }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder="Search title…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-56"
            />
          </form>
          <Select
            value={status || "all"}
            onValueChange={(v) =>
              navigate({ search: (s: Record<string, unknown>) => ({ ...s, status: v === "all" ? undefined : v }) })
            }
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="needs_clarification">Needs clarification</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Visibility</th>
              <th className="px-4 py-2">Updated</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No positions match these filters.
                </td>
              </tr>
            ) : (
              rows.map((p: {
                id: string;
                title: string;
                status: string;
                visibility: string;
                updated_at: string;
                organizations?: { id: string; name: string } | null;
              }) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.organizations?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLOR[p.status] ?? "bg-muted"}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.visibility}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/admin/positions/$id"
                      params={{ id: p.id }}
                      className="text-primary hover:underline"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
