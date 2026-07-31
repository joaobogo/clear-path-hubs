import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSupportOverview } from "@/lib/admin-workbench.functions";
import { startSupportSession, endSupportSession } from "@/lib/support.functions";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/_authenticated/admin/support")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({ queryKey: ["admin-support"], queryFn: () => getSupportOverview() }),
  head: () => ({
    meta: [
      { title: "Support view · TaaSFlow admin" },
      { name: "description", content: "Read-only, fully audited view of a client workspace." },
    ],
  }),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.support.tsx"),
  component: SupportPage,
});

function SupportPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["admin-support"], queryFn: () => getSupportOverview() });
  const startFn = useServerFn(startSupportSession);
  const endFn = useServerFn(endSupportSession);
  const [filter, setFilter] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async (organization_id: string) =>
      startFn({ data: { organization_id, mode: "read_only", reason: reason || "Support review" } }),
    onSuccess: async (_r, orgId) => {
      setMessage("Read-only session opened and logged. Opening the client workspace…");
      await qc.invalidateQueries({ queryKey: ["admin-support"] });
      window.open(`/client?org=${orgId}`, "_blank", "noopener");
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const end = useMutation({
    mutationFn: async (session_id: string) => endFn({ data: { session_id } }),
    onSuccess: async () => {
      setMessage("Session closed.");
      await qc.invalidateQueries({ queryKey: ["admin-support"] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const orgs = (data.organizations as any[]).filter((o) =>
    filter.trim() ? String(o.name).toLowerCase().includes(filter.trim().toLowerCase()) : true,
  );

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Support view</h1>
        <p className="text-sm text-muted-foreground">
          Open a client workspace as yourself — never as the client. The view is read-only by default, clearly
          labelled in-product, and every session and action is written to the audit log.
        </p>
      </header>

      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Open a workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter clients"
              className="max-w-xs"
              aria-label="Filter clients"
            />
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (ticket ref or short note)"
              className="max-w-sm"
              aria-label="Support reason"
            />
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clients match that filter.</p>
            ) : (
              orgs.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-md border border-border/60 p-2">
                  <span className="flex-1 text-sm font-medium">{o.name}</span>
                  <Badge variant="outline">{o.status}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => start.mutate(o.id)} disabled={start.isPending}>
                    Open read-only
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No support sessions recorded yet.</p>
          ) : (
            (data.sessions as any[]).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 p-2 text-sm">
                <Badge variant={s.mode === "interactive" ? "destructive" : "secondary"}>{s.mode}</Badge>
                <span className="font-medium">{s.org_name}</span>
                <span className="text-muted-foreground">{new Date(s.started_at).toLocaleString()}</span>
                {s.reason ? <span className="text-muted-foreground">· {s.reason}</span> : null}
                <span className="ml-auto text-muted-foreground">
                  {s.ended_at ? `Closed ${new Date(s.ended_at).toLocaleTimeString()}` : "Open"}
                </span>
                {!s.ended_at ? (
                  <Button size="sm" variant="ghost" onClick={() => end.mutate(s.id)}>
                    End
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Support audit trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {data.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No support actions logged.</p>
          ) : (
            (data.actions as any[]).map((a) => (
              <p key={a.id} className="text-sm text-muted-foreground">
                <span className="text-foreground">{a.action}</span> · {a.org_name} · {a.target_type ?? "—"} ·{" "}
                {new Date(a.occurred_at).toLocaleString()}
              </p>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Need to change something on a client&apos;s behalf? Use the admin surfaces directly —{" "}
        <Link to="/admin/positions" className="underline">
          positions
        </Link>{" "}
        and{" "}
        <Link to="/admin/candidates" className="underline">
          candidates
        </Link>{" "}
        — so the change is attributed to you.
      </p>
    </div>
  );
}
