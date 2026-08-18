import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getSupportOverview } from "@/lib/admin-workbench.functions";
import { startSupportSession } from "@/lib/support.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SupportSessionAuditList } from "@/components/admin/support-session-audit-list";

export const Route = createFileRoute("/_authenticated/admin/support")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({ queryKey: ["admin-support"], queryFn: () => getSupportOverview() }),
  head: () => ({
    meta: [
      { title: "Support view · TaaSFlow admin" },
      { name: "description", content: "Read-only, fully audited view of a client workspace." },
    ],
  }),
  component: SupportPage,
  errorComponent: makeRouteErrorComponent("admin", "_authenticated/admin.support"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

function SupportPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ queryKey: ["admin-support"], queryFn: () => getSupportOverview() });
  const startFn = useServerFn(startSupportSession);
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async (organization_id: string) =>
      startFn({ data: { organization_id, mode: "read_only", reason: reason.trim() } }),
    onSuccess: async (_r, orgId) => {
      setMessage("Read-only session opened and logged. Opening the client workspace…");
      await qc.invalidateQueries({ queryKey: ["admin-support"] });
      await qc.invalidateQueries({ queryKey: ["support-audit"] });
      // Same-tab navigation: `window.open(..., "_blank", "noopener")` is blocked
      // inside the embedded preview, which left the spinner copy on screen with
      // nothing ever opening.
      await navigate({ to: "/client", search: { org: orgId } });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const reasonValid = reason.trim().length >= 10;

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
              placeholder="Reason (required — ticket ref or short note)"
              className="max-w-sm"
              aria-label="Support reason"
              aria-describedby="support-reason-hint"
              required
            />
          </div>
          <p id="support-reason-hint" className="text-xs text-muted-foreground">
            {reasonValid
              ? "This reason is stored with the session and shown in the audit trail."
              : "A reason of at least 10 characters is required before a workspace can be opened."}
          </p>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clients match that filter.</p>
            ) : (
              orgs.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-md border border-border/60 p-2">
                  <span className="flex-1 text-sm font-medium">{o.name}</span>
                  <Badge variant="outline">{o.status}</Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => start.mutate(o.id)}
                    disabled={start.isPending || !reasonValid}
                    title={reasonValid ? undefined : "Enter a reason first"}
                  >
                    Open read-only
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <SupportSessionAuditList />

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
