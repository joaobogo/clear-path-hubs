/**
 * Operator SLA clock: which roles are approaching or past a commitment,
 * sorted by how close they are, with the client name and the promise.
 */
type Admin = any; // spans several generated table types

export type SlaClockRow = {
  position_id: string;
  position_title: string;
  organization_id: string;
  client_name: string;
  promise: string;
  due_at: string;
  hours_remaining: number;
  state: "met" | "at_risk" | "due_soon" | "overdue";
  detail: string;
};

const HOUR = 3_600_000;

export async function loadSlaClock(
  admin: Admin,
  opts: { includeTest?: boolean } = {},
): Promise<{ rows: SlaClockRow[]; generated_at: string }> {
  const { loadTestScope, excludeTestOrgs } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(admin, opts.includeTest ?? false);
  const { data: commitments, error } = await excludeTestOrgs(
    admin
      .from("position_commitments")
      .select(
        "position_id, organization_id, first_shortlist_days, shortlist_size, interview_slots_hours, baseline_at, positions:position_id(title, status), organizations:organization_id(name)",
      )
      .limit(500),
    scope,
  );
  if (error) throw error;


  const activeIds = (commitments ?? [])
    .filter((c: any) => c.positions && c.positions.status !== "closed" && c.positions.status !== "filled")
    .map((c: any) => c.position_id as string);

  const { data: published } = activeIds.length
    ? await admin
        .from("candidate_matches")
        .select("position_id, client_visibility, updated_at, created_at")
        .in("position_id", activeIds)
        .eq("client_visibility", "visible")
    : { data: [] as any[] };

  const publishedByPosition = new Map<string, number>();
  const firstPublishedAt = new Map<string, string>();
  for (const m of published ?? []) {
    const pid = m.position_id as string;
    publishedByPosition.set(pid, (publishedByPosition.get(pid) ?? 0) + 1);
    const at = (m.updated_at ?? m.created_at) as string;
    const cur = firstPublishedAt.get(pid);
    if (!cur || at < cur) firstPublishedAt.set(pid, at);
  }

  const now = Date.now();
  const rows: SlaClockRow[] = [];

  for (const c of commitments ?? []) {
    if (!activeIds.includes(c.position_id)) continue;
    const dueMs = new Date(c.baseline_at as string).getTime() + (c.first_shortlist_days as number) * 24 * HOUR;
    const count = publishedByPosition.get(c.position_id as string) ?? 0;
    const met = count >= (c.shortlist_size as number);
    const firstAt = firstPublishedAt.get(c.position_id as string);
    const hoursRemaining = Math.round((dueMs - now) / HOUR);

    let state: SlaClockRow["state"];
    if (met) state = "met";
    else if (hoursRemaining < 0) state = "overdue";
    else if (hoursRemaining <= 24) state = "due_soon";
    else if (hoursRemaining <= 72) state = "at_risk";
    else state = "at_risk";

    rows.push({
      position_id: c.position_id as string,
      position_title: (c.positions?.title as string) ?? "Role",
      organization_id: c.organization_id as string,
      client_name: (c.organizations?.name as string) ?? "Client",
      promise: `First shortlist of ${c.shortlist_size} within ${c.first_shortlist_days} days`,
      due_at: new Date(dueMs).toISOString(),
      hours_remaining: hoursRemaining,
      state,
      detail: met
        ? `Met — ${count} released${firstAt ? ` by ${new Date(firstAt).toLocaleDateString()}` : ""}`
        : `${count} of ${c.shortlist_size} released so far`,
    });
  }

  rows.sort((a, b) => {
    if (a.state === "met" && b.state !== "met") return 1;
    if (b.state === "met" && a.state !== "met") return -1;
    return a.hours_remaining - b.hours_remaining;
  });

  return { rows, generated_at: new Date().toISOString() };
}

export type HealthIssue = {
  id: string;
  kind: "webhook" | "processing" | "email" | "cv";
  label: string;
  detail: string;
  last_error: string | null;
  occurred_at: string;
  retryable: boolean;
};

export async function loadOperationalHealth(admin: Admin, opts: { includeTest?: boolean } = {}) {
  const staleCutoff = new Date(Date.now() - 2 * HOUR).toISOString();
  const { loadTestScope, excludeTestOrgs } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(admin, opts.includeTest ?? false);

  const [crmRes, jobsRes, deliveriesRes, cvRes] = await Promise.all([

    admin
      .from("crm_submission_queue")
      .select("id, status, attempts, last_error, created_at, source_form_id")
      .in("status", ["failed", "error", "retrying"])
      .order("created_at", { ascending: false })
      .limit(50),
    // `processing_jobs` has status/error_code/error_message/started_at — an
    // earlier version of this query used state/last_error/updated_at, which do
    // not exist, so stuck jobs never surfaced here. Terminal statuses
    // (completed, cancelled) are excluded: a cancelled job whose entity was
    // deleted is finished, not pending.
    admin
      .from("processing_jobs")
      .select("id, job_type, status, attempts, error_code, error_message, started_at, created_at")
      .in("status", ["failed", "running", "queued"])
      .lt("created_at", staleCutoff)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("notification_deliveries")
      .select("id, channel, status, error_message, attempt_count, updated_at")
      .in("status", ["failed", "bounced", "suppressed"])
      .order("updated_at", { ascending: false })
      .limit(100),
    excludeTestOrgs(
      admin
        .from("candidate_matches")
        .select(
          "id, processing_state, processing_updated_at, candidate_profiles:candidate_profile_id(full_name)",
        )
        // Every non-terminal or blocked processing state. "processing" is NOT a
        // member of the processing_state enum — sending it made PostgREST reject
        // the whole request with 22P02, so this bucket silently reported 0
        // forever and OCR/manual-review/provider-blocked CVs never surfaced.
        .in("processing_state", [
          "queued",
          "parsing",
          "ocr_required",
          "enriching",
          "ready_to_score",
          "scoring",
          "manual_review_required",
          "provider_blocked",
          "failed",
        ])
        .lt("processing_updated_at", staleCutoff)
        .order("processing_updated_at", { ascending: false })
        .limit(50),
      scope,
    ),
  ]);

  // Never let a bucket report a false zero: a failed query is an error, not "0".
  for (const res of [crmRes, jobsRes, deliveriesRes, cvRes]) {
    if (res.error) throw new Error(res.error.message);
  }




  const issues: HealthIssue[] = [];

  for (const r of crmRes.data ?? []) {
    issues.push({
      id: r.id as string,
      kind: "webhook",
      label: `CRM delivery (${r.source_form_id ?? "form"})`,
      detail: `${r.status} after ${r.attempts ?? 0} attempt(s)`,
      last_error: (r.last_error as string) ?? null,
      occurred_at: r.created_at as string,
      retryable: true,
    });
  }
  for (const r of jobsRes.data ?? []) {
    const seenAt = (r.started_at as string) ?? (r.created_at as string);
    issues.push({
      id: r.id as string,
      kind: "processing",
      label: `Job: ${r.job_type ?? "processing"}`,
      detail: `${r.status} since ${new Date(seenAt).toLocaleString()} — ${r.attempts ?? 0} attempt(s)`,
      last_error: (r.error_message as string) ?? (r.error_code as string) ?? null,
      occurred_at: seenAt,
      retryable: true,
    });
  }
  for (const r of deliveriesRes.data ?? []) {
    issues.push({
      id: r.id as string,
      kind: "email",
      label: `Email delivery (${r.channel})`,
      detail: `${r.status} after ${r.attempt_count ?? 0} attempt(s)`,
      last_error: (r.error_message as string) ?? null,
      occurred_at: r.updated_at as string,
      retryable: true,
    });
  }
  for (const r of cvRes.data ?? []) {
    issues.push({
      id: r.id as string,
      kind: "cv",
      label: `Unprocessed CV — ${(r.candidate_profiles?.full_name as string) ?? "candidate"}`,
      detail: `${r.processing_state} since ${new Date(r.processing_updated_at as string).toLocaleString()}`,
      last_error: null,
      occurred_at: r.processing_updated_at as string,
      retryable: true,
    });
  }

  const counts = {
    webhook: issues.filter((i) => i.kind === "webhook").length,
    processing: issues.filter((i) => i.kind === "processing").length,
    email: issues.filter((i) => i.kind === "email" && ["failed", "bounced", "suppressed"].includes(i.detail.split(" ")[0])).length,
    cv: issues.filter((i) => i.kind === "cv").length,
  };

  issues.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
  return { issues, counts, generated_at: new Date().toISOString() };
}

export async function retryHealthIssue(admin: Admin, kind: HealthIssue["kind"], id: string, actorUserId: string) {
  if (kind === "webhook") {
    await admin.from("crm_submission_queue").update({ status: "pending", last_error: null }).eq("id", id);
  } else if (kind === "processing") {
    // Re-arm for the drain worker: clear the error and the claim so the next
    // cron pass picks it up immediately.
    await admin
      .from("processing_jobs")
      .update({ status: "queued", error_code: null, error_message: null, started_at: null, completed_at: null })
      .eq("id", id);
    const { drainApplicationJobs } = await import("./pipeline-runner.server");
    void drainApplicationJobs({ limit: 3 }).catch(() => undefined);
  } else if (kind === "email") {
    const { retryDelivery } = await import("./notification-email.server");
    await retryDelivery(admin, id);
  } else if (kind === "cv") {
    await admin
      .from("candidate_matches")
      .update({ processing_state: "queued", processing_updated_at: new Date().toISOString() })
      .eq("id", id);
  }
  await admin.from("audit_events").insert({
    actor_user_id: actorUserId,
    action: "ops.retry",
    entity_type: kind,
    entity_id: id,
    metadata: { kind },
  } as never);
  return { ok: true };
}
