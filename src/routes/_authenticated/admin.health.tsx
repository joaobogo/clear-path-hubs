import { createFileRoute, Link } from "@tanstack/react-router";
import { TechnicalDetail } from "@/components/admin/technical-detail";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { humanizeCode, humanizeJobName, humanizeTechnicalError } from "@/lib/humanize-codes";
import { pluralize } from "@/lib/format/datetime";
import { sanitizeInternalMarkers } from "@/lib/human-labels";

import { getPipelineHealth } from "@/lib/admin.functions";
import { advanceProcessing, retryParse } from "@/lib/processing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { OperationalHealthPanel } from "@/components/admin/OperationalHealthPanel";
import { TeamsDeliveryPanel } from "@/components/admin/TeamsDeliveryPanel";
import { EmailDeliveryPanel } from "@/components/admin/EmailDeliveryPanel";
import { TrackingConfigPanel } from "@/components/admin/TrackingConfigPanel";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";


export const Route = createFileRoute("/_authenticated/admin/health")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["pipeline-health"],
      queryFn: () => getPipelineHealth(),
    }),
  head: () => ({ meta: [{ title: "Pipeline Health · TaaSFlow admin" }] }),
  component: HealthPage,
  errorComponent: makeRouteErrorComponent("admin", "_authenticated/admin.health"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

const STATE_ORDER = [
  "queued",
  "parsing",
  "ocr_required",
  "parsed",
  "enriching",
  "ready_to_score",
  "scoring",
  "scored",
  "manual_review_required",
  "provider_blocked",
  "failed",
];

function HealthPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["pipeline-health"],
    queryFn: () => getPipelineHealth(),
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const advanceFn = useServerFn(advanceProcessing);
  const retryFn = useServerFn(retryParse);

  const repair = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "advance" | "retry" }) => {
      return kind === "retry"
        ? await retryFn({ data: { match_id: id } })
        : await advanceFn({ data: { match_id: id } });
    },
    onSuccess: async (r) => {
      setFeedback(`Repair → ${humanizeCode(r.state).toLowerCase()} · trace ${r.trace_id}`);
      await qc.invalidateQueries({ queryKey: ["pipeline-health"] });
    },
    onError: (e: Error) => setFeedback(`Failed: ${e.message}`),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Pipeline Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Backlog, blockers, and repair actions. No separate page per error type — repair
          from here.
        </p>
      </header>

      {feedback && <Alert><AlertDescription>{feedback}</AlertDescription></Alert>}

      <OperationalHealthPanel />

      <TeamsDeliveryPanel />

      <EmailDeliveryPanel />

      <TrackingConfigPanel />


      <section>
        <h2 className="font-semibold mb-2">Backlog by state</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Each tile opens the candidate desk filtered to that processing state.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATE_ORDER.map((st) => {
            const n = data.states[st] ?? 0;
            const bad = ["failed", "provider_blocked", "ocr_required", "manual_review_required"].includes(st);
            return (
              <Link
                key={st}
                to="/admin/candidates"
                search={{ processing_state: st }}
                className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open candidates in state ${humanizeCode(st).toLowerCase()} (${n})`}
              >
                <div className="text-xs text-muted-foreground">{humanizeCode(st).toLowerCase()}</div>
                <div
                  className={`text-2xl font-semibold tabular-nums ${
                    bad && n > 0 ? "text-destructive" : ""
                  }`}
                >
                  {n}
                </div>
              </Link>
            );
          })}
        </div>
      </section>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Stale (in-flight &gt; 24h)</h3>
          <div className="mt-1 text-2xl font-semibold tabular-nums">{data.stale}</div>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="font-semibold">Provider incidents (7d)</h3>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {data.provider_incidents}
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-semibold">
          Jobs in trouble ({data.failed_jobs.length})
        </h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Failed jobs, plus jobs still queued or running for more than 24 hours — the same
          rows counted by “Processing exceptions” above.
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Job</th>
                <th className="px-3 py-2 font-medium">Error</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Attempts</th>
                <th className="px-3 py-2 font-medium">Repair</th>
              </tr>
            </thead>
            <tbody>
              {(data.failed_jobs as AnyRow[]).map((j) => (
                <tr key={j.id} className="border-t">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(j.created_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{humanizeJobName(j.job_type)}</td>
                  <td className="px-3 py-2">
                    <Badge variant="destructive">{humanizeCode(j.error_code ?? "error")}</Badge>{" "}
                    <span className="text-xs text-muted-foreground">
                      {humanizeTechnicalError(j.error_message) ?? "No further detail recorded."}
                    </span>
                    {j.error_message ? (
                      <TechnicalDetail
                        className="mt-1"
                        payload={sanitizeInternalMarkers(j.error_message)}
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {humanizeCode(j.status ?? "unknown").toLowerCase()}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {pluralize(j.attempts ?? 0, "attempt")}
                  </td>


                  <td className="px-3 py-2 space-x-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={repair.isPending}
                      onClick={() =>
                        repair.mutate({
                          id: j.entity_id,
                          kind: j.job_type === "parse" ? "retry" : "advance",
                        })
                      }
                    >
                      Retry
                    </Button>
                    <Link
                      to="/admin/candidates/$id"
                      params={{ id: j.entity_id }}
                      className="text-xs text-primary hover:underline"
                    >
                      open
                    </Link>
                  </td>
                </tr>
              ))}
              {data.failed_jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No jobs in trouble.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
