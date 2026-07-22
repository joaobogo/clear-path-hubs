import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPipelineHealth } from "@/lib/admin.functions";
import { listDeliveryFailures } from "@/lib/notifications.functions";
import { advanceProcessing, retryParse } from "@/lib/processing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Wifi, Server, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/operations")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["pipeline-health"],
      queryFn: () => getPipelineHealth(),
    }),
  head: () => ({
    meta: [
      { title: "Operations · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Operations unavailable: {error.message}</div>
  ),
  component: OperationsPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/** Root cause classifier for a failed job — drives grouping. */
function classifyRootCause(job: AnyRow): { key: string; icon: typeof AlertTriangle; label: string } {
  const code = String(job.error_code ?? "").toLowerCase();
  if (code.includes("provider") || code.includes("rate_limit") || code.includes("timeout"))
    return { key: "provider", icon: Wifi, label: "Provider" };
  if (code.includes("cv") || code.includes("parse") || code.includes("ocr"))
    return { key: "candidate", icon: User, label: "Candidate CV" };
  if (code.includes("position") || code.includes("requirements"))
    return { key: "position", icon: Server, label: "Position setup" };
  return { key: "process", icon: AlertTriangle, label: "Pipeline" };
}

function OperationsPage() {
  const qc = useQueryClient();
  const { data: health } = useSuspenseQuery({
    queryKey: ["pipeline-health"],
    queryFn: () => getPipelineHealth(),
  });
  const listDelivery = useServerFn(listDeliveryFailures);
  const { data: delivery } = useQuery({
    queryKey: ["admin", "delivery-failures"],
    queryFn: () => listDelivery(),
    refetchOnWindowFocus: true,
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const advanceFn = useServerFn(advanceProcessing);
  const retryFn = useServerFn(retryParse);

  const repair = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "advance" | "retry" }) =>
      kind === "retry"
        ? await retryFn({ data: { match_id: id } })
        : await advanceFn({ data: { match_id: id } }),
    onSuccess: async (r) => {
      setFeedback(`Repair → ${r.state} · trace ${r.trace_id}`);
      await qc.invalidateQueries({ queryKey: ["pipeline-health"] });
    },
    onError: (e: Error) => setFeedback(`Repair failed: ${e.message}`),
  });

  const jobs = (health.failed_jobs ?? []) as AnyRow[];
  const grouped = new Map<string, { icon: typeof AlertTriangle; label: string; jobs: AnyRow[] }>();
  for (const j of jobs) {
    const c = classifyRootCause(j);
    if (!grouped.has(c.key)) grouped.set(c.key, { icon: c.icon, label: c.label, jobs: [] });
    grouped.get(c.key)!.jobs.push(j);
  }

  const deliveryItems = ((delivery?.items ?? []) as unknown) as AnyRow[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Actionable incidents grouped by root cause. {jobs.length + deliveryItems.length} open.
        </p>
      </header>

      {feedback && (
        <Alert>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Aging in pipeline" value={health.stale} tone={health.stale > 0 ? "warn" : "ok"} />
        <Stat label="Failed jobs" value={jobs.length} tone={jobs.length > 0 ? "warn" : "ok"} />
        <Stat label="Provider incidents (7d)" value={health.provider_incidents} />
        <Stat label="Delivery failures" value={deliveryItems.length} tone={deliveryItems.length > 0 ? "warn" : "ok"} />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline incidents ({jobs.length})</TabsTrigger>
          <TabsTrigger value="delivery">Delivery failures ({deliveryItems.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          {grouped.size === 0 ? (
            <div className="rounded-lg border bg-card px-5 py-10 text-sm text-muted-foreground text-center">
              No incidents. Pipeline is clean.
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([key, group]) => {
                const Icon = group.icon;
                return (
                  <section key={key} className="rounded-lg border bg-card">
                    <header className="px-5 py-3 border-b flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold">
                        {group.label} — {group.jobs.length}
                      </h2>
                    </header>
                    <ul className="divide-y text-sm">
                      {group.jobs.slice(0, 12).map((j) => (
                        <li key={j.id} className="px-5 py-3 flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{j.job_type}</span>
                              <Badge variant="destructive">{j.error_code ?? "error"}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {j.error_message}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                              trace {j.trace_id} · {new Date(j.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              onClick={() => repair.mutate({ id: j.entity_id, kind: "retry" })}
                              disabled={repair.isPending}
                            >
                              Retry
                            </Button>
                            <Link
                              to="/admin/candidates/$id"
                              params={{ id: j.entity_id }}
                              className="text-xs text-primary hover:underline text-center"
                            >
                              Open record
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="delivery" className="mt-4">
          {deliveryItems.length === 0 ? (
            <div className="rounded-lg border bg-card px-5 py-10 text-sm text-muted-foreground text-center">
              No delivery issues.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-4 py-2">When</th>
                    <th className="px-4 py-2">Audience</th>
                    <th className="px-4 py-2">Event</th>
                    <th className="px-4 py-2">Channel</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryItems.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(d.updated_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 capitalize">{d.notifications?.audience}</td>
                      <td className="px-4 py-2">{d.notifications?.event_type}</td>
                      <td className="px-4 py-2">{d.channel}</td>
                      <td className="px-4 py-2">
                        <Badge variant="destructive">{d.status}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground truncate max-w-xs">
                        {d.error_message ?? d.error_code ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "ok" }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          tone === "warn" && value > 0
            ? "text-amber-600 dark:text-amber-400"
            : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
