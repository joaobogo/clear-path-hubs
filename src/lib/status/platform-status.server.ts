/**
 * Public platform status — measurement.
 *
 * Every value returned here is measured during the request that renders the
 * status page. Where a measurement is unavailable the service is reported as
 * `unknown`. Nothing is cached, inferred from a previous check, or assumed.
 *
 * Reads use a publishable-key client (anon) plus a service-role client only
 * for aggregate counts of operational tables. Only counts and coarse bands
 * ever leave this module — never rows, ids, error strings, or any hint of
 * infrastructure.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  BACKLOG_QUEUED_MINUTES,
  BACKLOG_RUNNING_MINUTES,
  NOT_MEASURED_DETAIL,
  SERVICES,
  headlineFor,
  isDisrupted,
  statusFromBacklog,
  statusFromFailureRatio,
  statusFromProbe,
  worstStatus,
  type PlatformStatus,
  type ServiceKey,
  type ServiceStatus,
  type StatusLevel,
  type StatusNotice,
} from "./platform-status";

const WINDOW_24H = "last 24 hours";
const WINDOW_7D = "last 7 days";
const WINDOW_NOW = "at page load";

function since(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/** Wall-clock a promise without letting a slow dependency hang the page. */
async function timed<T>(
  fn: () => Promise<T>,
  budgetMs = 6_000,
): Promise<{ ok: boolean; ms: number; value: T | null }> {
  const started = Date.now();
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("budget")), budgetMs),
      ),
    ]);
    return { ok: true, ms: Date.now() - started, value };
  } catch {
    return { ok: false, ms: Date.now() - started, value: null };
  }
}

function serviceRow(
  key: ServiceKey,
  status: StatusLevel,
  detail: string,
  measured: boolean,
  window: string,
): ServiceStatus {
  const def = SERVICES.find((s) => s.key === key)!;
  return {
    key,
    name: def.name,
    covers: def.covers,
    measured_by: def.measured_by,
    status,
    detail,
    measured,
    window,
    // Only a probe taken in this request describes the present moment.
    covers_now: measured && window === WINDOW_NOW,
    maintenance_note: null,
  };
}

/** A read-path probe: did a scoped count answer, and how quickly. */
async function probeRead(
  client: SupabaseClient,
  table: string,
  key: ServiceKey,
): Promise<ServiceStatus> {
  const run = await timed(async () => {
    const { error } = await client.from(table).select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;
    return true;
  });
  if (!run.ok) {
    return serviceRow(key, "major_outage", "The check did not complete.", true, WINDOW_NOW);
  }
  const verdict = statusFromProbe({ ok: true, ms: run.ms });
  return serviceRow(key, verdict.status, verdict.detail, true, WINDOW_NOW);
}

function normaliseIntegrationStatus(raw: string): "ok" | "degraded" | "down" {
  const v = raw.toLowerCase();
  if (["ok", "operational", "healthy", "passing", "connected", "success"].includes(v)) return "ok";
  if (["degraded", "slow", "warning", "warn", "delayed", "partial"].includes(v)) return "degraded";
  return "down";
}

// ------------------------------------------------------------------ notices

const NOTICE_COLUMNS =
  "id, kind, title, summary, severity, state, services, started_at, resolved_at, scheduled_start, scheduled_end";

function toNotice(row: Record<string, unknown>): StatusNotice {
  return {
    id: String(row["id"]),
    kind: row["kind"] === "maintenance" ? "maintenance" : "incident",
    title: String(row["title"]),
    summary: String(row["summary"]),
    severity: (row["severity"] as StatusLevel) ?? "unknown",
    state: String(row["state"]),
    services: Array.isArray(row["services"]) ? (row["services"] as ServiceKey[]) : [],
    started_at: String(row["started_at"]),
    resolved_at: (row["resolved_at"] as string | null) ?? null,
    scheduled_start: (row["scheduled_start"] as string | null) ?? null,
    scheduled_end: (row["scheduled_end"] as string | null) ?? null,
  };
}

const OPEN_INCIDENT_STATES = new Set(["investigating", "identified", "monitoring"]);
const OPEN_MAINTENANCE_STATES = new Set(["scheduled", "in_progress"]);

// --------------------------------------------------------------------- main

export async function measurePlatformStatus(): Promise<PlatformStatus> {
  const url = process.env["SUPABASE_URL"];
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const checkedAt = new Date().toISOString();

  // The public website is measured by the fact that this request produced a
  // response. That is a real measurement, not an assumption.
  const website = serviceRow(
    "website",
    "operational",
    "This page was served successfully.",
    true,
    WINDOW_NOW,
  );

  if (!url || !publishableKey) {
    // Without a way to reach the backend we measure nothing and say so.
    const unmeasured = SERVICES.filter((s) => s.key !== "website").map((s) =>
      serviceRow(s.key, "unknown", NOT_MEASURED_DETAIL, false, WINDOW_NOW),
    );
    return {
      checked_at: checkedAt,
      overall: "unknown",
      headline: headlineFor("unknown", []),
      services: [website, ...unmeasured],
      active_incidents: [],
      incident_history: [],
      maintenance: [],
      history_since: null,
      subscription_supported: false,
    };
  }

  const anon = createClient(url, publishableKey, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (publishableKey.startsWith("sb_") && headers.get("Authorization") === `Bearer ${publishableKey}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", publishableKey);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [
    auth,
    workspace,
    roles,
    candidateData,
    fileStorage,
    realtime,
    agents,
    scoring,
    integrations,
    notifications,
    billing,
    notices,
  ] = await Promise.all([
    // Authentication — a live liveness check of the sign-in service.
    (async (): Promise<ServiceStatus> => {
      const run = await timed(async () => {
        const res = await fetch(`${url}/auth/v1/health`, {
          headers: { apikey: publishableKey },
        });
        if (!res.ok) throw new Error("unhealthy");
        return true;
      });
      if (!run.ok) {
        return serviceRow("authentication", "major_outage", "The check did not complete.", true, WINDOW_NOW);
      }
      const verdict = statusFromProbe({ ok: true, ms: run.ms });
      return serviceRow("authentication", verdict.status, verdict.detail, true, WINDOW_NOW);
    })(),

    probeRead(supabaseAdmin, "organizations", "workspace"),
    probeRead(supabaseAdmin, "positions", "roles"),
    probeRead(supabaseAdmin, "candidate_matches", "candidate_data"),

    // File storage — a live check that the private document store answers.
    (async (): Promise<ServiceStatus> => {
      const run = await timed(async () => {
        const { error } = await supabaseAdmin.storage.from("cvs").list("", { limit: 1 });
        if (error) throw error;
        return true;
      });
      if (!run.ok) {
        return serviceRow("file_storage", "major_outage", "The check did not complete.", true, WINDOW_NOW);
      }
      const verdict = statusFromProbe({ ok: true, ms: run.ms });
      return serviceRow("file_storage", verdict.status, verdict.detail, true, WINDOW_NOW);
    })(),

    // Live updates — a real connection handshake with the realtime service.
    (async (): Promise<ServiceStatus> => {
      const run = await timed(async () => {
        const wsUrl = `${url.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(
          publishableKey,
        )}&vsn=1.0.0`;
        // A real connection, opened and closed. Both runtimes we deploy to
        // expose the standard WebSocket client.
        const WS = (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
        if (!WS) throw new Error("no websocket client");
        const socket = new WS(wsUrl);
        await new Promise<void>((resolve, reject) => {
          socket.addEventListener("open", () => resolve(), { once: true });
          socket.addEventListener("error", () => reject(new Error("closed")), { once: true });
          socket.addEventListener("close", () => reject(new Error("closed")), { once: true });
        });
        try {
          socket.close();
        } catch {
          /* nothing to clean up */
        }
        return true;
      }, 5_000);

      if (!run.ok) {
        return serviceRow("realtime", "major_outage", "The check did not complete.", true, WINDOW_NOW);
      }
      const verdict = statusFromProbe({ ok: true, ms: run.ms });
      return serviceRow("realtime", verdict.status, verdict.detail, true, WINDOW_NOW);
    })(),


    // Agent processing — what is unfinished right now.
    //
    // Deliberately not a failure ratio over the last day: a run that failed or
    // was cancelled hours ago is history and cannot be what a reader is waiting
    // on, so it must never raise a live warning. Only work still queued or
    // running, and already past its threshold, counts as behind.
    (async (): Promise<ServiceStatus> => {
      const run = await timed(async () => {
        const { data, error } = await supabaseAdmin
          .from("processing_jobs")
          .select("status, created_at, started_at")
          .in("status", ["queued", "running"])
          .limit(5_000);
        if (error) throw error;
        return data ?? [];
      });
      if (!run.ok || !run.value) {
        return serviceRow("agents", "unknown", NOT_MEASURED_DETAIL, false, WINDOW_NOW);
      }
      const rows = run.value as {
        status: string;
        created_at: string | null;
        started_at: string | null;
      }[];
      const now = Date.now();
      const minutesSince = (iso: string | null): number =>
        iso ? Math.floor((now - new Date(iso).getTime()) / 60_000) : 0;

      const ages = rows.map((r) => {
        const running = r.status === "running";
        const waited = minutesSince(running ? (r.started_at ?? r.created_at) : r.created_at);
        const threshold = running ? BACKLOG_RUNNING_MINUTES : BACKLOG_QUEUED_MINUTES;
        return { waited, overdue: waited > threshold };
      });
      const overdue = ages.filter((a) => a.overdue);
      const verdict = statusFromBacklog({
        pending: rows.length,
        overdue: overdue.length,
        oldestOverdueMinutes: overdue.reduce((max, a) => Math.max(max, a.waited), 0),
      });
      return serviceRow("agents", verdict.status, verdict.detail, verdict.measured, WINDOW_NOW);
    })(),



    // Scoring — outcomes of scoring runs in the last day.
    (async (): Promise<ServiceStatus> => {
      const run = await timed(async () => {
        const { data, error } = await supabaseAdmin
          .from("score_runs")
          .select("status, error_code")
          .gte("created_at", since(24))
          .limit(5_000);
        if (error) throw error;
        return data ?? [];
      });
      if (!run.ok || !run.value) {
        return serviceRow("scoring", "unknown", NOT_MEASURED_DETAIL, false, WINDOW_24H);
      }
      const rows = run.value as { status: string | null; error_code: string | null }[];
      const failed = rows.filter(
        (r) => (r.status ?? "").toLowerCase() === "failed" || Boolean(r.error_code),
      ).length;
      const verdict = statusFromFailureRatio({
        total: rows.length,
        failed,
        noun: "scoring runs",
        window: WINDOW_24H,
      });
      return serviceRow("scoring", verdict.status, verdict.detail, verdict.measured, WINDOW_24H);
    })(),

    // Integrations — the latest recorded check per connection.
    (async (): Promise<ServiceStatus> => {
      const run = await timed(async () => {
        const { data, error } = await supabaseAdmin
          .from("integration_health_checks")
          .select("integration, status, created_at")
          .order("created_at", { ascending: false })
          .limit(300);
        if (error) throw error;
        return data ?? [];
      });
      if (!run.ok || !run.value) {
        return serviceRow("integrations", "unknown", NOT_MEASURED_DETAIL, false, "most recent check");
      }
      const rows = run.value as { integration: string; status: string }[];
      const latest = new Map<string, string>();
      for (const row of rows) if (!latest.has(row.integration)) latest.set(row.integration, row.status);
      if (latest.size === 0) {
        return serviceRow(
          "integrations",
          "unknown",
          "No connection checks have been recorded, so there is nothing to measure.",
          false,
          "most recent check",
        );
      }
      const verdicts = [...latest.values()].map(normaliseIntegrationStatus);
      const down = verdicts.filter((v) => v === "down").length;
      const degraded = verdicts.filter((v) => v === "degraded").length;
      const status: StatusLevel =
        down === verdicts.length
          ? "major_outage"
          : down > 0
            ? "partial_outage"
            : degraded > 0
              ? "degraded_performance"
              : "operational";
      const detail =
        down === 0 && degraded === 0
          ? `${verdicts.length} of ${verdicts.length} connections passed their most recent check.`
          : `${verdicts.length - down - degraded} of ${verdicts.length} connections passed their most recent check.`;
      return serviceRow("integrations", status, detail, true, "most recent check");
    })(),

    // Notifications — delivery outcomes in the last day.
    //
    // A blocked recipient is a person who was not informed, so it counts as a
    // failure here. Counting only completed rows once let this page read
    // "Operational" while the delivery log held failures from the same window;
    // one failure in-window can no longer produce an Operational verdict.
    (async (): Promise<ServiceStatus> => {
      const run = await timed(async () => {
        const { data, error } = await supabaseAdmin
          .from("notification_deliveries")
          .select("status, error_code")
          .gte("last_attempt_at", since(24))
          .limit(5_000);
        if (error) throw error;
        return data ?? [];
      });
      if (!run.ok || !run.value) {
        return serviceRow("notifications", "unknown", NOT_MEASURED_DETAIL, false, WINDOW_24H);
      }
      const rows = run.value as { status: string; error_code: string | null }[];
      const settled = rows.filter((r) => isSettledDelivery(r.status, r.error_code));
      const failed = settled.filter((r) => countsAsDeliveryFailure(r.status, r.error_code)).length;
      const verdict = statusFromFailureRatio({
        total: settled.length,
        failed,
        noun: "notification deliveries",
        window: WINDOW_24H,
      });
      if (failed === 0) {
        return serviceRow(
          "notifications",
          verdict.status,
          verdict.detail,
          verdict.measured,
          WINDOW_24H,
        );
      }
      const status: StatusLevel = isDisrupted(verdict.status)
        ? verdict.status
        : "degraded_performance";
      const detail = `${failed} of ${settled.length} notification deliveries did not reach their recipient in the ${WINDOW_24H}.`;
      return serviceRow("notifications", status, detail, true, WINDOW_24H);
    })(),

    // Billing — payment and subscription events in the last week.
    (async (): Promise<ServiceStatus> => {
      const run = await timed(async () => {
        const [payments, events] = await Promise.all([
          supabaseAdmin
            .from("payments")
            .select("status")
            .gte("created_at", since(24 * 7))
            .limit(2_000),
          supabaseAdmin
            .from("subscription_webhook_events")
            .select("event_id", { count: "exact", head: true })
            .gte("processed_at", since(24 * 7)),
        ]);
        if (payments.error) throw payments.error;
        if (events.error) throw events.error;
        return { rows: (payments.data ?? []) as { status: string }[], events: events.count ?? 0 };
      });
      if (!run.ok || !run.value) {
        return serviceRow("billing", "unknown", NOT_MEASURED_DETAIL, false, WINDOW_7D);
      }
      const { rows, events } = run.value;
      const settled = rows.filter((r) => ["paid", "pending", "unpaid"].includes(r.status));
      if (settled.length === 0 && events === 0) {
        return serviceRow(
          "billing",
          "unknown",
          `No checkout or subscription activity happened in the ${WINDOW_7D}, so there is nothing to measure.`,
          false,
          WINDOW_7D,
        );
      }
      // A checkout that was started and never settled is the honest failure
      // signal here; refunds and exemptions are normal business outcomes.
      const stuck = settled.filter((r) => r.status === "unpaid").length;
      const verdict = statusFromFailureRatio({
        total: settled.length || events,
        failed: stuck,
        noun: settled.length ? "checkouts" : "billing events",
        window: WINDOW_7D,
      });
      return serviceRow("billing", verdict.status, verdict.detail, true, WINDOW_7D);
    })(),

    // Published notices. Read with the anon client so the page can only ever
    // show what is genuinely public.
    (async () => {
      const run = await timed(async () => {
        const { data, error } = await anon
          .from("status_incidents")
          .select(NOTICE_COLUMNS)
          .eq("published", true)
          .order("started_at", { ascending: false })
          .limit(100);
        if (error) throw error;
        return (data ?? []) as unknown as Record<string, unknown>[];
      });
      return run.value ? run.value.map(toNotice) : null;
    })(),
  ]);

  const services = [
    website,
    auth,
    workspace,
    roles,
    agents,
    candidateData,
    fileStorage,
    realtime,
    scoring,
    integrations,
    notifications,
    billing,
  ];

  const allNotices = notices ?? [];
  const activeIncidents = allNotices.filter(
    (n) => n.kind === "incident" && OPEN_INCIDENT_STATES.has(n.state),
  );
  const incidentHistory = allNotices.filter(
    (n) => n.kind === "incident" && !OPEN_INCIDENT_STATES.has(n.state),
  );
  const maintenance = allNotices.filter(
    (n) => n.kind === "maintenance" && OPEN_MAINTENANCE_STATES.has(n.state),
  );

  // Maintenance in force right now overrides a measured status: a paused
  // service is not an outage, and saying so is the honest reading.
  const now = Date.now();
  const inWindow = maintenance.filter((n) => {
    const start = n.scheduled_start ? Date.parse(n.scheduled_start) : Date.parse(n.started_at);
    const end = n.scheduled_end ? Date.parse(n.scheduled_end) : Number.POSITIVE_INFINITY;
    return n.state === "in_progress" || (start <= now && now <= end);
  });
  for (const notice of inWindow) {
    for (const service of services) {
      if (!notice.services.includes(service.key)) continue;
      service.status = "maintenance";
      service.maintenance_note = notice.title;
    }
  }

  // An open incident can only escalate a service, never soften it.
  for (const incident of activeIncidents) {
    for (const service of services) {
      if (!incident.services.includes(service.key)) continue;
      service.status = worstStatus([service.status, incident.severity]);
    }
  }

  const overall = worstStatus(services.map((s) => s.status));
  const disruptedNames = services.filter((s) => isDisrupted(s.status)).map((s) => s.name);
  const oldest = allNotices.at(-1);

  return {
    checked_at: checkedAt,
    overall,
    headline: headlineFor(overall, disruptedNames),
    services,
    active_incidents: activeIncidents,
    incident_history: incidentHistory,
    maintenance,
    history_since: oldest ? oldest.started_at : null,
    // No subscription mechanism exists for status changes, so the page must
    // not offer one.
    subscription_supported: false,
  };
}
