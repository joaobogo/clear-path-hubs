import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getIntegrationHealth,
  runIntegrationChecks,
  type IntegrationId,
  type IntegrationCheckRow,
} from "@/lib/integration-health.functions";

const healthQuery = {
  queryKey: ["integration-health"] as const,
  queryFn: () => getIntegrationHealth(),
};

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  loader: ({ context }) => context.queryClient.ensureQueryData(healthQuery),
  head: () => ({ meta: [{ title: "Integration health · TaaSFlow admin" }] }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.integrations.tsx",
  ),
  component: IntegrationHealthPage,
});

const LABELS: Record<IntegrationId, { name: string; what: string }> = {
  stripe: { name: "Payments (Stripe)", what: "Checkout, plan catalog, receipts" },
  attio: { name: "CRM (Attio)", what: "Lead capture from every public form" },
  calendly: { name: "Booking (Calendly)", what: "Every 'Book a call' button" },
  email: { name: "Email deliverability", what: "Notifications, receipts, digests" },
};

const STATUS_STYLE: Record<
  IntegrationCheckRow["status"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ok: { label: "Healthy", variant: "default" },
  degraded: { label: "Needs attention", variant: "secondary" },
  failed: { label: "Failing", variant: "destructive" },
  not_configured: { label: "Not configured", variant: "outline" },
};

function when(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function IntegrationHealthPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(healthQuery);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [open, setOpen] = useState<IntegrationId | null>(null);
  const runFn = useServerFn(runIntegrationChecks);

  const run = useMutation({
    mutationFn: async (integrations?: IntegrationId[]) =>
      await runFn({ data: integrations ? { integrations } : {} }),
    onSuccess: async (result) => {
      const bad = result.results.filter((r) => r.status !== "ok").length;
      setFeedback(
        bad === 0
          ? `Ran ${result.ran} test${result.ran === 1 ? "" : "s"} — everything healthy.`
          : `Ran ${result.ran} test${result.ran === 1 ? "" : "s"} — ${bad} need${bad === 1 ? "s" : ""} attention.`,
      );
      await qc.invalidateQueries({ queryKey: ["integration-health"] });
    },
    onError: (e: Error) => setFeedback(`Could not complete the tests: ${e.message}`),
  });

  const failing = data.integrations.filter(
    (i) => i.latest && i.latest.status !== "ok",
  ).length;
  const untested = data.integrations.filter((i) => !i.latest).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Integration health</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live read-only tests against the four systems the business depends on. Each run
            is recorded, so you can see when something broke and what the provider said.
          </p>
        </div>
        <Button onClick={() => run.mutate(undefined)} disabled={run.isPending}>
          {run.isPending ? "Testing…" : "Run all tests"}
        </Button>
      </header>

      {feedback && (
        <Alert>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      {untested > 0 && !run.isPending && (
        <Alert>
          <AlertDescription>
            {untested} integration{untested === 1 ? " has" : "s have"} never been tested. Run
            the tests to establish a baseline.
          </AlertDescription>
        </Alert>
      )}

      {failing > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {failing} integration{failing === 1 ? "" : "s"} reported a problem in the latest
            run. Expand the card for the provider error and the fix.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.integrations.map(({ id, latest, history }) => {
          const style = latest ? STATUS_STYLE[latest.status] : null;
          const expanded = open === id;
          return (
            <section key={id} className="rounded-lg border p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{LABELS[id].name}</h2>
                  <p className="text-xs text-muted-foreground">{LABELS[id].what}</p>
                </div>
                {style ? (
                  <Badge variant={style.variant}>{style.label}</Badge>
                ) : (
                  <Badge variant="outline">Never tested</Badge>
                )}
              </div>

              <p className="mt-3 text-sm">
                {latest ? latest.summary : "No test result recorded yet."}
              </p>

              {latest && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last run {when(latest.created_at)}
                  {latest.latency_ms != null ? ` · ${latest.latency_ms} ms` : ""}
                </p>
              )}

              {latest && latest.status !== "ok" && (
                <div className="mt-3 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  {latest.error_code && (
                    <div className="font-mono text-xs text-destructive">
                      {latest.error_code}
                    </div>
                  )}
                  {latest.error_detail && (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                      {latest.error_detail}
                    </pre>
                  )}
                  {latest.remediation && (
                    <p className="text-xs">
                      <span className="font-medium">What to do: </span>
                      {latest.remediation}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={run.isPending}
                  onClick={() => run.mutate([id])}
                >
                  Test now
                </Button>
                {history.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOpen(expanded ? null : id)}
                  >
                    {expanded ? "Hide history" : `History (${history.length})`}
                  </Button>
                )}
              </div>

              {expanded && (
                <ul className="mt-3 space-y-2 border-t pt-3">
                  {history.map((row) => (
                    <li key={row.id} className="text-xs">
                      <span className="text-muted-foreground">
                        {new Date(row.created_at).toLocaleString()}
                      </span>{" "}
                      <Badge variant={STATUS_STYLE[row.status].variant}>
                        {STATUS_STYLE[row.status].label}
                      </Badge>{" "}
                      <span className="text-muted-foreground">{row.summary}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Tests are read-only: they list catalog entries, read CRM object names, resolve the
        booking page and read recent delivery events. No customer is charged, contacted or
        created.
      </p>
    </main>
  );
}
