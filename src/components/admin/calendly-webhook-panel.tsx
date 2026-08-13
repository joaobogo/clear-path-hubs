import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getCalendlyWebhookStatus,
  provisionCalendlyWebhook,
  removeCalendlyWebhook,
} from "@/lib/booking/calendly-webhooks.functions";
import { PanelState } from "@/components/admin/panel-state";
import { toastError } from "@/lib/toast-error";

const QUERY_KEY = ["calendly-webhook-status"] as const;

/**
 * Booking capture status: whether Calendly is pushing completed bookings,
 * reschedules and cancellations into TaaSFlow, and the last deliveries received.
 */
export function CalendlyWebhookPanel() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getCalendlyWebhookStatus);
  const provisionFn = useServerFn(provisionCalendlyWebhook);
  const removeFn = useServerFn(removeCalendlyWebhook);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => statusFn(),
  });
  const { data, isLoading } = query;

  const provision = useMutation({
    mutationFn: async () => await provisionFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't provision. Nothing was saved — please try again." }),
  });

  const remove = useMutation({
    mutationFn: async (uri: string) => await removeFn({ data: { uri } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't remove. Nothing was saved — please try again." }),
  });

  const ours = data?.subscriptions.filter((s) => s.isOurs) ?? [];
  const active = ours.some((s) => s.state === "active");

  return (
    <section className="rounded-lg border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Booking capture (Calendly webhooks)</h2>
          <p className="text-xs text-muted-foreground">
            Completed bookings, reschedules and cancellations recorded automatically
          </p>
        </div>
        {isLoading ? (
          <Badge variant="outline">Checking…</Badge>
        ) : active ? (
          <Badge>Receiving</Badge>
        ) : (
          <Badge variant="secondary">Not receiving</Badge>
        )}
      </div>

      <PanelState query={query} className="mt-4" isEmpty={false}>
        {data && (
          <div className="mt-4 space-y-3 text-sm">
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">Delivery URL</dt>
              <dd className="break-all font-mono text-xs">{data.callbackUrl}</dd>
              <dt className="text-muted-foreground">Events</dt>
              <dd className="text-xs">{data.events.join(", ")}</dd>
              <dt className="text-muted-foreground">Signature key</dt>
              <dd className="text-xs">
                {data.signingKeyConfigured ? "Configured" : "Missing — deliveries would be rejected"}
              </dd>
              <dt className="text-muted-foreground">Calendly account</dt>
              <dd className="text-xs">{data.owner ? data.owner.name : "Not connected"}</dd>
            </dl>

            {data.error && (
              <Alert variant="destructive">
                <AlertDescription className="break-words text-xs">{data.error}</AlertDescription>
              </Alert>
            )}

            {!active && !data.error && (
              <Alert>
                <AlertDescription className="text-xs">
                  Calendly is not pushing bookings yet. Register the subscription to record every
                  completed booking without anyone re-entering it.
                </AlertDescription>
              </Alert>
            )}

            {data.subscriptions.length > 0 && (
              <ul className="space-y-2 border-t pt-3">
                {data.subscriptions.map((sub) => (
                  <li key={sub.uri} className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={sub.state === "active" ? "default" : "secondary"}>
                      {sub.state}
                    </Badge>
                    <span className="break-all font-mono">{sub.callbackUrl}</span>
                    {!sub.isOurs && <Badge variant="outline">Other destination</Badge>}
                    {sub.retryStartedAt && (
                      <Badge variant="destructive">Retrying since {sub.retryStartedAt}</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(sub.uri)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                size="sm"
                disabled={provision.isPending || !data.signingKeyConfigured}
                onClick={() => provision.mutate()}
              >
                {provision.isPending
                  ? "Registering…"
                  : active
                    ? "Re-register subscription"
                    : "Register subscription"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => qc.invalidateQueries({ queryKey: QUERY_KEY })}
              >
                Refresh
              </Button>
            </div>

            {provision.data && !provision.data.ok && (
              <Alert variant="destructive">
                <AlertDescription className="break-words text-xs">
                  {provision.data.error}
                </AlertDescription>
              </Alert>
            )}
            {provision.data?.ok && (
              <Alert>
                <AlertDescription className="text-xs">
                  Registered. Calendly will now post bookings to {provision.data.callbackUrl}.
                </AlertDescription>
              </Alert>
            )}

            <div className="border-t pt-3">
              <h3 className="text-xs font-medium">Last deliveries received</h3>
              {data.recentDeliveries.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No deliveries recorded yet. The next completed booking will appear here.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {data.recentDeliveries.map((d) => (
                    <li key={d.id} className="text-xs text-muted-foreground">
                      {d.receivedAt ? new Date(d.receivedAt).toLocaleString() : "—"} ·{" "}
                      <span className="font-mono">{d.eventType}</span> ·{" "}
                      {d.matchedSession ? "matched a booking session" : "no matching session"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </PanelState>
    </section>
  );
}
