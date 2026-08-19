/**
 * Integration health strip. Server-only.
 *
 * Every chip is derived from a stored artifact of a real check:
 *   - the newest row in `integration_health_checks` (a probe that actually ran)
 *   - queue depth and oldest unprocessed age in `crm_submission_queue` /
 *     `processing_jobs`
 *   - the newest `calendly_webhook_events` row (proof deliveries arrive)
 *   - aggregate per-client rows in `integration_sync_status`
 *
 * Nothing is ever assumed healthy. If no probe exists, or the newest probe is
 * older than the integration's expected interval, or reading the signal throws,
 * the chip is "unknown" and carries the reason. Only a fresh `ok` probe (with
 * queues under threshold) renders healthy.
 */

type Admin = any;

const MIN = 60_000;
const HOUR = 60 * MIN;

export type StripState = "healthy" | "degraded" | "failing" | "not_configured" | "unknown";

export type QueueSignal = {
  key: "crm" | "processing";
  label: string;
  depth: number;
  threshold: number;
  oldest_at: string | null;
  oldest_age_minutes: number | null;
  drainable: boolean;
  error: string | null;
};

export type StripChip = {
  key: "stripe" | "attio" | "calendly" | "email";
  name: string;
  state: StripState;
  reason: string;
  expected_interval_minutes: number;
  last_check_at: string | null;
  last_check_status: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_detail: string | null;
  check_error: string | null;
  queue: QueueSignal | null;
  clients: { healthy: number; degraded: number; failing: number; not_connected: number } | null;
};

type Def = {
  key: StripChip["key"];
  name: string;
  expectedMinutes: number;
  syncKeys: string[];
  queue: QueueSignal["key"] | null;
};

const DEFS: Def[] = [
  { key: "stripe", name: "Payments", expectedMinutes: 24 * 60, syncKeys: ["stripe"], queue: null },
  { key: "attio", name: "CRM (Attio)", expectedMinutes: 6 * 60, syncKeys: ["attio", "crm"], queue: "crm" },
  { key: "calendly", name: "Booking (Calendly)", expectedMinutes: 6 * 60, syncKeys: ["calendly"], queue: null },
  { key: "email", name: "Email delivery", expectedMinutes: 24 * 60, syncKeys: ["email"], queue: "processing" },
];

const QUEUE_THRESHOLD: Record<QueueSignal["key"], number> = { crm: 5, processing: 10 };

function ageMinutes(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / MIN));
}

async function loadQueue(admin: Admin, key: QueueSignal["key"]): Promise<QueueSignal> {
  const base: QueueSignal = {
    key,
    label: key === "crm" ? "CRM submissions awaiting sync" : "Processing jobs awaiting a worker",
    depth: 0,
    threshold: QUEUE_THRESHOLD[key],
    oldest_at: null,
    oldest_age_minutes: null,
    drainable: true,
    error: null,
  };
  try {
    if (key === "crm") {
      const { data, error, count } = await admin
        .from("crm_submission_queue")
        .select("id, created_at", { count: "exact" })
        .in("status", ["pending", "retrying", "failed", "error"])
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw new Error(error.message);
      const oldest = (data ?? [])[0]?.created_at ?? null;
      return { ...base, depth: count ?? 0, oldest_at: oldest, oldest_age_minutes: ageMinutes(oldest) };
    }
    const { data, error, count } = await admin
      .from("processing_jobs")
      .select("id, created_at", { count: "exact" })
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: true })
      .limit(1);
    if (error) throw new Error(error.message);
    const oldest = (data ?? [])[0]?.created_at ?? null;
    return { ...base, depth: count ?? 0, oldest_at: oldest, oldest_age_minutes: ageMinutes(oldest) };
  } catch (e) {
    return {
      ...base,
      drainable: false,
      error: e instanceof Error ? e.message.slice(0, 300) : "queue_read_failed",
    };
  }
}

export async function loadIntegrationStrip(admin: Admin) {
  const [checksRes, syncRes, webhookRes, crmSynced, crmQueue, jobQueue] = await Promise.all([
    admin
      .from("integration_health_checks")
      .select("integration, status, summary, error_code, error_detail, created_at")
      .order("created_at", { ascending: false })
      .limit(400)
      .then((r: any) => r, (e: any) => ({ error: e })),
    admin
      .from("integration_sync_status")
      .select("integration_key, state, last_success_at, last_error_at, last_error")
      .limit(1000)
      .then((r: any) => r, (e: any) => ({ error: e })),
    admin
      .from("calendly_webhook_events")
      .select("received_at")
      .order("received_at", { ascending: false })
      .limit(1)
      .then((r: any) => r, (e: any) => ({ error: e })),
    admin
      .from("crm_submission_queue")
      .select("synced_at")
      .eq("status", "synced")
      .order("synced_at", { ascending: false })
      .limit(1)
      .then((r: any) => r, (e: any) => ({ error: e })),
    loadQueue(admin, "crm"),
    loadQueue(admin, "processing"),
  ]);

  const checkErr = checksRes?.error ? String(checksRes.error.message ?? checksRes.error) : null;
  const rows = (checksRes?.data ?? []) as any[];
  const syncRows = (syncRes?.data ?? []) as any[];

  const chips: StripChip[] = DEFS.map((def) => {
    const own = rows.filter((r) => r.integration === def.key);
    const latest = own[0] ?? null;
    const lastOk = own.find((r) => r.status === "ok") ?? null;
    const lastBad = own.find((r) => r.status === "failed" || r.status === "degraded") ?? null;

    const mine = syncRows.filter((s) => def.syncKeys.includes(s.integration_key));
    const clients = mine.length
      ? {
          healthy: mine.filter((s) => s.state === "healthy").length,
          degraded: mine.filter((s) => s.state === "degraded").length,
          failing: mine.filter((s) => s.state === "failing").length,
          not_connected: mine.filter((s) => s.state === "not_connected").length,
        }
      : null;

    const queue = def.queue === "crm" ? crmQueue : def.queue === "processing" ? jobQueue : null;

    // Widest evidence of a real success: a passing probe, a per-client sync
    // success, a delivered webhook (Calendly) or a synced CRM row.
    const successCandidates: (string | null)[] = [
      lastOk?.created_at ?? null,
      ...mine.map((s) => s.last_success_at ?? null),
    ];
    if (def.key === "calendly") successCandidates.push((webhookRes?.data ?? [])[0]?.received_at ?? null);
    if (def.key === "attio") successCandidates.push((crmSynced?.data ?? [])[0]?.synced_at ?? null);
    const lastSuccessAt =
      successCandidates.filter(Boolean).sort().reverse()[0] ?? null;

    const failureCandidates = [
      lastBad?.created_at ?? null,
      ...mine.map((s) => s.last_error_at ?? null),
    ].filter(Boolean) as string[];
    const lastFailureAt = failureCandidates.sort().reverse()[0] ?? null;
    const failureDetail =
      (lastBad?.error_detail as string) ??
      (lastBad?.summary as string) ??
      (mine.find((s) => s.last_error)?.last_error as string) ??
      null;

    let state: StripState;
    let reason: string;

    const queueOver = queue ? queue.depth > queue.threshold : false;
    const staleMs = def.expectedMinutes * MIN;

    if (checkErr) {
      state = "unknown";
      reason = `Health check history could not be read — ${checkErr.slice(0, 160)}`;
    } else if (queue?.error) {
      state = "unknown";
      reason = `Queue depth could not be read — ${queue.error}`;
    } else if (!latest) {
      state = "unknown";
      reason = "No health check has ever run for this integration.";
    } else if (latest.status === "not_configured") {
      state = "not_configured";
      reason = latest.summary ?? "Not configured in this environment.";
    } else if (latest.status === "failed") {
      state = "failing";
      reason = latest.summary ?? "The last health check failed.";
    } else if (Date.now() - new Date(latest.created_at).getTime() > staleMs) {
      state = "unknown";
      reason = `Last check ran ${Math.round(ageMinutes(latest.created_at)! / 60)}h ago, past the ${Math.round(def.expectedMinutes / 60)}h expected interval — re-run to confirm.`;
    } else if (latest.status === "degraded" || queueOver || (clients?.failing ?? 0) > 0) {
      state = "degraded";
      reason = queueOver
        ? `${queue!.depth} items waiting (threshold ${queue!.threshold})${queue!.oldest_age_minutes != null ? `, oldest ${queue!.oldest_age_minutes} min old` : ""}.`
        : (clients?.failing ?? 0) > 0
          ? `${clients!.failing} client connection${clients!.failing === 1 ? "" : "s"} failing.`
          : (latest.summary ?? "Degraded in the last check.");
    } else if (
      lastSuccessAt &&
      Date.now() - new Date(lastSuccessAt).getTime() > staleMs &&
      def.key !== "stripe"
    ) {
      state = "degraded";
      reason = `Last successful activity was ${Math.round(ageMinutes(lastSuccessAt)! / 60)}h ago, past the ${Math.round(def.expectedMinutes / 60)}h expected interval.`;
    } else {
      state = "healthy";
      reason = latest.summary ?? "Last check passed.";
    }

    return {
      key: def.key,
      name: def.name,
      state,
      reason,
      expected_interval_minutes: def.expectedMinutes,
      last_check_at: latest?.created_at ?? null,
      last_check_status: latest?.status ?? null,
      last_success_at: lastSuccessAt,
      last_failure_at: lastFailureAt,
      last_failure_detail: failureDetail ? String(failureDetail).slice(0, 400) : null,
      check_error: checkErr,
      queue,
      clients,
    };
  });

  return { chips, generated_at: new Date().toISOString() };
}

/**
 * Drain the CRM queue with the same sync path the public form uses
 * (`syncSubmissionToAttio`) — no second implementation of the mapping.
 */
export async function drainCrmQueue(admin: Admin, limit = 10) {
  const { data, error } = await admin
    .from("crm_submission_queue")
    .select("*")
    .in("status", ["pending", "retrying", "failed", "error"])
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 25));
  if (error) throw new Error(error.message);

  const { syncSubmissionToAttio } = await import("./crm/attio-sync.server");
  let synced = 0;
  let failed = 0;

  for (const row of (data ?? []) as any[]) {
    // Claim so a concurrent drain cannot double-send the same submission.
    const { data: claimed } = await admin
      .from("crm_submission_queue")
      .update({ status: "retrying", attempts: (row.attempts ?? 0) + 1 })
      .eq("id", row.id)
      .eq("status", row.status)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const ids = await syncSubmissionToAttio(row);
      await admin
        .from("crm_submission_queue")
        .update({
          status: "synced",
          synced_at: new Date().toISOString(),
          attio_person_id: ids.personId,
          attio_company_id: ids.companyId,
          attio_deal_id: ids.dealId,
          attio_note_id: ids.noteId,
          last_error: null,
        })
        .eq("id", row.id);
      synced += 1;
    } catch (e) {
      await admin
        .from("crm_submission_queue")
        .update({
          status: "pending",
          last_error: e instanceof Error ? e.message.slice(0, 400) : "attio_unknown_error",
        })
        .eq("id", row.id);
      failed += 1;
    }
  }

  return { processed: synced + failed, synced, failed };
}

export async function drainIntegrationQueueByKey(
  admin: Admin,
  key: QueueSignal["key"],
  actorUserId: string,
) {
  let result: { processed: number; synced?: number; failed?: number };
  if (key === "crm") {
    result = await drainCrmQueue(admin);
  } else {
    const { drainApplicationJobs } = await import("./pipeline-runner.server");
    const outcomes = await drainApplicationJobs({ limit: 10 });
    result = {
      processed: outcomes.length,
      synced: outcomes.filter((o) => o.status === "completed").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
    };
  }

  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "integration.queue_drain",
    entity_type: "integration_queue",
    entity_id: null,
    metadata: { queue: key, ...result },
  } as never);

  return result;
}
