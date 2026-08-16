import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { EmptyState, PageBody, PageHeader, PageShell, Section, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  clearTrackedEvents,
  getTrackedEvents,
  subscribeTrackedEvents,
  trackEvent,
  verifyTrackers,
  type TrackedEventRecord,
} from "@/lib/tracking/pixels";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const Route = createFileRoute("/dev/tracking")({
  component: TrackingDiagnostics,
  head: () => ({
    meta: [
      { title: "Tracking Diagnostics — TaaSFlow" },
      {
        name: "description",
        content:
          "Debug view: which analytics and pixel tags are loaded, and every event fired during this session.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type TrackerRow = {
  key: string;
  status: "loaded" | "pending" | "missing" | "missing-config";
  id: string | null;
  detail: string;
};

const TRACKER_LABELS: Record<string, string> = {
  ga4: "Google Analytics 4",
  rb2b: "RB2B (Retention.com)",
  meta: "Meta Pixel",
  linkedin: "LinkedIn Insight Tag",
  clarity: "Microsoft Clarity",
  hotjar: "Hotjar",
};

const STATUS_TONE: Record<TrackerRow["status"], "success" | "warning" | "danger" | "neutral"> = {
  loaded: "success",
  pending: "warning",
  missing: "danger",
  "missing-config": "neutral",
};

const STATUS_LABEL: Record<TrackerRow["status"], string> = {
  loaded: "Loaded",
  pending: "Injected, booting",
  missing: "Not injected",
  "missing-config": "Not configured",
};

function maskId(id: string | null) {
  if (!id) return "—";
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function TrackingDiagnostics() {
  const [trackers, setTrackers] = useState<TrackerRow[]>([]);
  const [events, setEvents] = useState<TrackedEventRecord[]>([]);
  const [blocked, setBlocked] = useState<Array<{ tracker: string; uri: string; at: string }>>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const result = verifyTrackers();
    setTrackers(
      Object.entries(result).map(([key, value]) => ({
        key,
        status: value.status,
        id: value.id,
        detail: value.detail,
      })),
    );
    setEvents(getTrackedEvents().slice().reverse());
    setBlocked(window._taasflow_tracking?.diagnostics?.slice(-20).reverse() ?? []);
    setCheckedAt(new Date().toLocaleTimeString(APP_LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE }));
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeTrackedEvents(refresh);
    const timer = window.setInterval(refresh, 2000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [refresh]);

  const summary = useMemo(() => {
    const loaded = trackers.filter((t) => t.status === "loaded").length;
    const configured = trackers.filter((t) => t.status !== "missing-config").length;
    return { loaded, configured };
  }, [trackers]);

  return (
    <PageShell>
      <PageHeader
        title="Tracking diagnostics"
        description="Live view of the tags on this page and every event fired since the document loaded. In-memory only — nothing is persisted and no visitor data leaves the browser."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="mr-2 size-4" /> Re-check
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                clearTrackedEvents();
                refresh();
              }}
            >
              <Trash2 className="mr-2 size-4" /> Clear log
            </Button>
            <Button
              onClick={() =>
                trackEvent("diagnostics_test", {
                  page_path: window.location.pathname,
                  source: "tracking_diagnostics",
                })
              }
            >
              Fire test event
            </Button>
          </div>
        }
      />
      <PageBody>
        <Section
          title="Pixel tags"
          description={`${summary.loaded} of ${summary.configured} configured tags loaded${
            checkedAt ? ` · checked ${checkedAt}` : ""
          }.`}
        >
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Tag</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {trackers.map((tracker) => (
                  <tr key={tracker.key} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">
                      {TRACKER_LABELS[tracker.key] ?? tracker.key}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge tone={STATUS_TONE[tracker.status]}>
                        {STATUS_LABEL[tracker.status]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {maskId(tracker.id)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{tracker.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Events this session"
          description="Newest first. Shows the canonical event plus the name each provider received and where it was delivered."
        >
          {events.length === 0 ? (
            <EmptyState
              title="No events yet"
              description="Navigate around the app or fire a test event to populate the log."
            />
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.seq} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{event.name}</span>
                    {event.queued ? (
                      <StatusBadge tone="warning">Queued</StatusBadge>
                    ) : (
                      <StatusBadge tone={event.delivered.length ? "success" : "danger"}>
                        {event.delivered.length ? event.delivered.join(", ") : "no provider ready"}
                      </StatusBadge>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(event.at).toLocaleTimeString(APP_LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <span>
                      GA4: <span className="font-mono">{event.ga4Event}</span>
                    </span>
                    <span>
                      Label: <span className="font-mono">{event.label}</span>
                    </span>
                    <span>
                      Meta: <span className="font-mono">{event.metaEvent ?? "not mapped"}</span>
                    </span>
                    <span>
                      LinkedIn:{" "}
                      <span className="font-mono">
                        {event.linkedinConversionId || "not mapped"}
                      </span>
                    </span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
                    {JSON.stringify(event.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Blocked requests"
          description="Content-Security-Policy violations attributed to a tag — usually an ad blocker or a missing CSP allowance."
        >
          {blocked.length === 0 ? (
            <EmptyState title="Nothing blocked" description="No policy violations recorded." />
          ) : (
            <ul className="space-y-1 text-sm">
              {blocked.map((entry) => (
                <li key={`${entry.at}-${entry.uri}`} className="rounded border border-border p-2">
                  <span className="font-medium">{entry.tracker}</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">{entry.uri}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </PageBody>
    </PageShell>
  );
}
