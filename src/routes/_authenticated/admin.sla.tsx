import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { getSlaClock } from "@/lib/admin-workbench.functions";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { TestRecordsToggle } from "@/components/admin/TestRecordsToggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const searchSchema = z.object({
  show_test: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/admin/sla")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ show_test: search.show_test }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-sla-clock", deps.show_test],
      queryFn: () => getSlaClock({ data: { include_test: deps.show_test } }),
    }),
  head: () => ({
    meta: [
      { title: "SLA clock · TaaSFlow admin" },
      { name: "description", content: "Roles approaching or past a service commitment, sorted by urgency." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.sla.tsx"),
  component: SlaClockPage,
});


const STATE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  overdue: { label: "Past promise", variant: "destructive" },
  due_soon: { label: "Due within 24h", variant: "default" },
  at_risk: { label: "Approaching", variant: "secondary" },
  met: { label: "Met", variant: "outline" },
};

function humanRemaining(hours: number) {
  if (hours < 0) {
    const h = Math.abs(hours);
    return h >= 48 ? `${Math.round(h / 24)} days late` : `${h}h late`;
  }
  return hours >= 48 ? `${Math.round(hours / 24)} days left` : `${hours}h left`;
}

function SlaClockPage() {
  const { show_test } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-sla-clock", show_test],
    queryFn: () => getSlaClock({ data: { include_test: show_test } }),
  });
  const rows = data.rows;
  const open = rows.filter((r) => r.state !== "met");
  const met = rows.filter((r) => r.state === "met");

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">SLA clock</h1>
          <p className="text-sm text-muted-foreground">
            Every live role with a commitment, sorted by how close it is to the promise we made.
          </p>
          <p className="text-xs text-muted-foreground">
            {show_test
              ? "Including test and internal organizations."
              : "Test and internal organizations are hidden."}
          </p>
        </div>
        <TestRecordsToggle
          checked={show_test}
          onChange={(next) => navigate({ search: { show_test: next }, replace: true })}
        />
      </header>


      <div className="grid gap-3 sm:grid-cols-3">
        {(["overdue", "due_soon", "at_risk"] as const).map((state) => (
          <Card key={state}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{STATE_LABEL[state].label}</p>
              <p className="text-2xl font-semibold">{rows.filter((r) => r.state === state).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Open commitments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open commitments. Every live role is inside its promise.</p>
          ) : (
            open.map((r) => (
              <div
                key={r.position_id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 p-3"
              >
                <Badge variant={STATE_LABEL[r.state].variant}>{STATE_LABEL[r.state].label}</Badge>
                <div className="min-w-[220px] flex-1">
                  <Link
                    to="/admin/positions/$id"
                    params={{ id: r.position_id }}
                    className="font-medium hover:underline"
                  >
                    {r.position_title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {r.client_name} · {r.promise}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{humanRemaining(r.hours_remaining)}</p>
                  <p className="text-xs text-muted-foreground">
                    Due {new Date(r.due_at).toLocaleDateString()} · {r.detail}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {met.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Met ({met.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {met.map((r) => (
              <p key={r.position_id} className="text-sm text-muted-foreground">
                {r.position_title} — {r.client_name} · {r.detail}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
