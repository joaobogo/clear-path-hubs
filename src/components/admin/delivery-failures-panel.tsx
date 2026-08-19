import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  listDeliveryFailureQueue,
  releaseNotificationRecipient,
  retryDeliveryFailureFn,
  suppressNotificationRecipient,
  unsuppressAndRetryDelivery,
} from "@/lib/notification-failures.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

type Item = {
  key: string;
  ledger: "notification" | "lead";
  id: string;
  eventType: string;
  eventLabel: string;
  title: string | null;
  audience: string | null;
  channel: string;
  recipient: string | null;
  reason: string;
  reasonDetail: string | null;
  reasonLabel: string;
  reasonSentence: string;
  canUnsuppress: boolean;
  attempts: number;
  firstAttemptAt: string;
  lastAttemptAt: string;
  retryable: boolean;
  retryBlockedReason: string | null;
  staleWarning: boolean;
  relatedPath: string | null;
  payloadJson: string;
};

function when(iso: string) {
  return new Date(iso).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE });
}

export function DeliveryFailuresPanel() {
  const list = useServerFn(listDeliveryFailureQueue);
  const retry = useServerFn(retryDeliveryFailureFn);
  const suppress = useServerFn(suppressNotificationRecipient);
  const release = useServerFn(releaseNotificationRecipient);
  const unsuppress = useServerFn(unsuppressAndRetryDelivery);
  const qc = useQueryClient();

  const [staleTarget, setStaleTarget] = useState<Item | null>(null);
  const [suppressTarget, setSuppressTarget] = useState<Item | null>(null);
  const [suppressReason, setSuppressReason] = useState("");

  const query = useQuery({
    queryKey: ["admin", "delivery-failure-queue"],
    queryFn: () => list(),
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["admin", "delivery-failure-queue"] });

  const retryMut = useMutation({
    mutationFn: (item: Item) => retry({ data: { ledger: item.ledger, id: item.id } }),
    onSuccess: (res) => {
      if (res.status === "already_sent") {
        toast.success("Already delivered — nothing was re-sent.");
      } else if (res.ok) {
        toast.success("Re-sent through the original send path.");
      } else {
        toast.error(res.detail ?? "The retry failed again.");
      }
      void invalidate();
    },
    onError: (e: unknown) => toastError(e, { fallback: "Retry failed" }),
  });

  const suppressMut = useMutation({
    mutationFn: (args: { email: string; reason: string }) => suppress({ data: args }),
    onSuccess: (res) => {
      toast.success(
        res.alreadySuppressed
          ? "That address was already suppressed."
          : "Recipient suppressed — future sends will be blocked.",
      );
      setSuppressTarget(null);
      setSuppressReason("");
      void invalidate();
    },
    onError: (e: unknown) => toastError(e, { fallback: "Could not suppress" }),
  });

  const releaseMut = useMutation({
    mutationFn: (email: string) => release({ data: { email } }),
    onSuccess: () => {
      toast.success("Suppression lifted.");
      void invalidate();
    },
    onError: (e: unknown) => toastError(e, { fallback: "Could not lift" }),
  });

  // One backend path (unsuppressAndRetryDelivery) clears the blocks and
  // re-attempts the same delivery. Every message below reflects what the
  // backend actually reported — a provider-level bounce block stays blocked.
  const unsuppressMut = useMutation({
    mutationFn: (item: Item) =>
      unsuppress({
        data: {
          email: item.recipient!.split(",")[0]!.trim(),
          ledger: item.ledger,
          id: item.id,
        },
      }),
    onSuccess: (res) => {
      const p = res.unsuppress.provider;
      if (p.state === "not_liftable" || p.state === "unknown") {
        toast.error(p.detail);
      } else if (res.retry.attempted && res.retry.ok) {
        toast.success("Block lifted and the notification was re-sent.");
      } else if (res.retry.attempted) {
        toast.error(res.retry.detail ?? "Block lifted, but the re-send failed again.");
      } else {
        toast.success("Block lifted.");
      }
      void invalidate();
    },
    onError: (e: unknown) => toastError(e, { fallback: "Could not lift the block" }),
  });

  const [limit, setLimit] = useState(8);
  const items = ((query.data?.items ?? []) as Item[]).slice(0, limit);
  const summary = query.data?.summary ?? {
    total: items.length,
    retryable: items.filter((i) => i.retryable).length,
    blockedDeliveries: 0,
    blockedAddresses: [] as Array<{
      address: string;
      deliveries: number;
      lastAttemptAt: string;
      sentence: string;
    }>,
  };
  const blockedAddresses = summary.blockedAddresses;
  const suppressions = query.data?.suppressions ?? [];
  const windowDays = query.data?.windowDays ?? 7;

  const firstRecipientEmail = useMemo(() => {
    if (!suppressTarget?.recipient) return "";
    return suppressTarget.recipient.split(",")[0]!.trim();
  }, [suppressTarget]);

  async function copyPayload(item: Item) {
    try {
      await navigator.clipboard.writeText(item.payloadJson);
      toast.success("Payload copied");
    } catch {
      toast.error("Clipboard unavailable in this browser");
    }
  }

  // Every retry re-sends a real notification to a real person, so every retry
  // confirms first — not only the time-sensitive ones. Cancel is the default.
  function onRetry(item: Item) {
    setStaleTarget(item);
  }

  return (
    <section className="mt-10" id="delivery-failures">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Delivery failures</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Notifications whose final attempt did not succeed in the last {windowDays} days.
          Anything listed here means someone believes they were informed and was not.
        </p>
      </header>

      {/* A suppressed address is not a backlog: every new notification to it
          fails the moment it is sent, so the row count climbs with normal
          console use. Retrying cannot clear it — releasing the address can. */}
      {blockedAddresses.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="text-sm font-medium">
            {blockedAddresses.length} blocked address
            {blockedAddresses.length === 1 ? "" : "es"} are generating these failures
          </div>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            {summary.blockedDeliveries} of {summary.total} rows below come from addresses on a
            suppression list. Every further notification to them fails on send, so retrying will
            not clear the list — release the address first, or the count keeps growing.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {blockedAddresses.slice(0, 5).map((a) => (
              <li key={a.address} className="flex items-center justify-between gap-3">
                <span className="break-all font-medium">{a.address}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {a.deliveries} blocked send{a.deliveries === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}


      <PanelState
        query={query}
        isEmpty={items.length === 0}
        empty={
          <PanelEmpty
            title="No delivery failures"
            description={`No delivery failures in the last ${windowDays} days.`}
          />
        }
      >
        <div className="border rounded-lg overflow-x-auto max-h-[480px]">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Recipient</th>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Failure reason</th>
                <th className="px-4 py-2">Attempts</th>
                <th className="px-4 py-2">First / last attempt</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key} className="border-t align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.eventLabel}</div>
                    {item.title ? (
                      <div className="text-xs text-muted-foreground">{item.title}</div>
                    ) : null}
                    {item.audience ? (
                      <Badge variant="outline" className="mt-1 capitalize">
                        {item.audience}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 break-all">{item.recipient ?? "—"}</td>
                  <td className="px-4 py-3">{item.channel}</td>
                  {/* Human sentence only — the raw code and provider payload
                      stay behind "Copy payload". */}
                  <td className="px-4 py-3 max-w-[320px]">
                    <div className="font-medium">{item.reasonLabel}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item.reasonSentence}</div>
                    {item.staleWarning ? (
                      <div className="text-xs text-amber-600 mt-1">
                        Time-sensitive and over 24h old — re-sending may mislead.
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{item.attempts}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    <div>{when(item.firstAttemptAt)}</div>
                    <div>{when(item.lastAttemptAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2 justify-end">
                      {item.retryable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retryMut.isPending}
                          onClick={() => onRetry(item)}
                        >
                          Retry
                        </Button>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground max-w-[180px] text-right"
                          title={item.retryBlockedReason ?? undefined}
                        >
                          {item.retryBlockedReason ?? "Not retryable"}
                        </span>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => void copyPayload(item)}>
                        Copy payload
                      </Button>
                      {item.relatedPath ? (
                        <Button size="sm" variant="ghost" asChild>
                          <Link to={item.relatedPath as never}>Open record</Link>
                        </Button>
                      ) : null}
                      {item.recipient && item.canUnsuppress ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unsuppressMut.isPending}
                          onClick={() => unsuppressMut.mutate(item)}
                        >
                          Remove from suppression &amp; retry
                        </Button>
                      ) : null}
                      {item.recipient && item.channel === "email" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSuppressTarget(item);
                            setSuppressReason("");
                          }}
                        >
                          Suppress
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(query.data?.items?.length ?? 0) > limit && (
          <div className="p-3 border-t bg-muted/20 text-center">
            <Button variant="link" size="sm" onClick={() => setLimit(1000)}>
              See all {query.data?.items?.length} failures
            </Button>
          </div>
        )}
      </PanelState>

      {suppressions.length > 0 ? (
        <Card className="p-4 mt-6">
          <p className="text-sm font-medium mb-2">Suppressed recipients</p>
          <ul className="space-y-2">
            {suppressions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 text-sm">
                <span>
                  <span className="font-medium break-all">{s.email}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {s.reason ?? s.source} · {when(s.created_at)}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={releaseMut.isPending}
                  onClick={() => releaseMut.mutate(s.email)}
                >
                  Lift
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Dialog open={!!staleTarget} onOpenChange={(o) => !o && setStaleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {staleTarget?.staleWarning
                ? "This notification is time-sensitive"
                : "Re-send this notification"}
            </DialogTitle>
            <DialogDescription>
              {staleTarget
                ? staleTarget.staleWarning
                  ? `"${staleTarget.eventType}" first failed on ${when(staleTarget.firstAttemptAt)}. Sending it now may reference something that has already passed. Send anyway?`
                  : `"${staleTarget.eventType}" is sent again to ${staleTarget.recipient ?? "the original recipient"} by ${staleTarget.channel}, immediately.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStaleTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={retryMut.isPending}
              onClick={() => {
                if (staleTarget) retryMut.mutate(staleTarget);
                setStaleTarget(null);
              }}
            >
              {staleTarget?.staleWarning ? "Send anyway" : "Send again"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!suppressTarget} onOpenChange={(o) => !o && setSuppressTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suppress {firstRecipientEmail}</DialogTitle>
            <DialogDescription>
              Every later send to this address is blocked until the suppression is lifted.
              Give a reason so the decision stays reviewable.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={suppressReason}
            onChange={(e) => setSuppressReason(e.target.value)}
            placeholder="Why is this address being suppressed? (min 10 characters)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuppressTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={suppressReason.trim().length < 10 || suppressMut.isPending}
              onClick={() =>
                suppressMut.mutate({ email: firstRecipientEmail, reason: suppressReason.trim() })
              }
            >
              Suppress recipient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
