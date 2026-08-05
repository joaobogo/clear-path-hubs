/**
 * Audited exports of admin list data.
 *
 * Rules that this module owns and that no caller can bypass:
 *  - Every export is a row in `export_jobs` (requester, scope, filters, row
 *    count, whether contact details were included, timestamps). No export can
 *    happen without that record — the row is written before any data is read.
 *  - Scope is never unlimited: a position or an organization must be named, and
 *    the row cap is hard-capped server-side.
 *  - Contact columns (email, phone) are only written when *every* row in scope
 *    has contact release for the requester. One un-released row omits the
 *    columns for the whole file and the omission is stated in the file header.
 *  - CSV is generated here, server-side, from the same scoped view the UI reads;
 *    raw rows are never handed to the browser for client-side CSV building.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export const EXPORT_ROW_CAP = 5000;
export const EXPORT_BUCKET = "exports";
/** Download links stay valid for this long once minted. */
export const DOWNLOAD_TTL_SECONDS = 300;

export type ExportFilters = {
  organization_id?: string;
  position_id?: string;
  stage?: string;
  client_visibility?: string;
  recommendation?: string;
  score_band?: string;
  date_from?: string;
  date_to?: string;
  include_contact?: boolean;
};

export type ExportJobRow = {
  id: string;
  export_type: string;
  status: "queued" | "running" | "completed" | "failed" | "expired";
  scope_label: string | null;
  filters: Record<string, unknown>;
  row_count: number | null;
  contact_included: boolean;
  contact_omission_reason: string | null;
  requested_at: string;
  completed_at: string | null;
  error: string | null;
  requester_name: string | null;
  downloadable: boolean;
};

const CONTACT_COLUMNS = ["email", "phone"] as const;

const BASE_COLUMNS = [
  "match_id",
  "candidate_profile_id",
  "position_id",
  "org_name",
  "position_title",
  "full_name",
  "country",
  "location",
  "stage",
  "admin_status",
  "client_visibility",
  "processing_state",
  "eligibility_status",
  "recommendation",
  "score_band",
  "fit_label",
  "source_kind",
  "created_at",
  "updated_at",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function applyFilters(q: Any, f: ExportFilters, scope: { positionIds: string[] }): Any {
  if (f.organization_id) q = q.eq("organization_id", f.organization_id);
  if (f.position_id) q = q.eq("position_id", f.position_id);
  if (f.stage) q = q.eq("stage", f.stage);
  if (f.client_visibility) q = q.eq("client_visibility", f.client_visibility);
  if (f.recommendation) q = q.eq("recommendation", f.recommendation);
  if (f.score_band) q = q.eq("score_band", f.score_band);
  if (f.date_from) q = q.gte("created_at", f.date_from);
  if (f.date_to) q = q.lte("created_at", f.date_to);
  // Test/internal records follow the same global rule as every admin list.
  if (scope.positionIds.length > 0) q = q.not("position_id", "in", `(${scope.positionIds.join(",")})`);
  return q;
}

export async function describeScope(s: Any, f: ExportFilters): Promise<string> {
  const parts: string[] = [];
  if (f.position_id) {
    const { data } = await s
      .from("positions")
      .select("title")
      .eq("id", f.position_id)
      .maybeSingle();
    parts.push(`Position: ${data?.title ?? f.position_id}`);
  }
  if (f.organization_id) {
    const { data } = await s
      .from("organizations")
      .select("name")
      .eq("id", f.organization_id)
      .maybeSingle();
    parts.push(`Client: ${data?.name ?? f.organization_id}`);
  }
  if (f.stage) parts.push(`Stage: ${f.stage}`);
  if (f.client_visibility) parts.push(`Visibility: ${f.client_visibility}`);
  if (f.recommendation) parts.push(`Recommendation: ${f.recommendation}`);
  if (f.score_band) parts.push(`Band: ${f.score_band}`);
  if (f.date_from || f.date_to) parts.push(`Applied ${f.date_from ?? "…"} → ${f.date_to ?? "…"}`);
  return parts.join(" · ") || "Candidate list";
}

/** Creates the audit row first, then returns its id. Never skipped. */
export async function createExportJob(
  s: Any,
  args: { userId: string; filters: ExportFilters; scopeLabel: string },
): Promise<string> {
  const { data, error } = await s
    .from("export_jobs")
    .insert({
      requested_by: args.userId,
      organization_id: args.filters.organization_id ?? null,
      export_type: "admin_candidate_list",
      filters: args.filters as never,
      scope_label: args.scopeLabel,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/**
 * Runs a queued/failed job: reads the scoped rows, decides contact inclusion,
 * writes the CSV to the private `exports` bucket and closes the audit row.
 */
export async function runExportJob(
  s: Any,
  jobId: string,
  userId: string,
): Promise<{ status: "completed" | "failed"; error?: string }> {
  const { data: job, error: jobError } = await s
    .from("export_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error("Export not found");
  if (job.requested_by !== userId) throw new Error("forbidden");

  await s.from("export_jobs").update({ status: "running", error: null }).eq("id", jobId);

  try {
    const filters = (job.filters ?? {}) as ExportFilters;
    if (!filters.position_id && !filters.organization_id) {
      throw new Error("Export scope must name a position or a client.");
    }

    const { loadTestScope } = await import("./admin-test-scope.server");
    const scope = await loadTestScope(s);

    const select = [...BASE_COLUMNS, ...CONTACT_COLUMNS, "contact_released"].join(",");
    let q = s.from("v_admin_candidate_index").select(select, { count: "exact" });
    q = applyFilters(q, filters, { positionIds: scope.positionIds });
    q = q.order("created_at", { ascending: false }).limit(EXPORT_ROW_CAP);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Any[];

    const withheld = list.filter((r) => r.contact_released !== true).length;
    const requested = filters.include_contact === true;
    const includeContact = requested && list.length > 0 && withheld === 0;
    const omissionReason = !requested
      ? null
      : list.length === 0
        ? "No rows in scope."
        : withheld > 0
          ? `Contact columns omitted: contact details are not released to you for ${withheld} of ${list.length} rows in scope.`
          : null;

    const columns = includeContact ? [...BASE_COLUMNS, ...CONTACT_COLUMNS] : [...BASE_COLUMNS];
    const header: string[] = [
      `# TaaSFlow candidate export ${jobId}`,
      `# Generated ${new Date().toISOString()} · scope: ${job.scope_label ?? "candidate list"}`,
      `# Rows: ${list.length}${(count ?? 0) > EXPORT_ROW_CAP ? ` (capped at ${EXPORT_ROW_CAP} of ${count})` : ""}`,
      includeContact
        ? "# Contact details: INCLUDED (released to the requester for every row in scope)"
        : `# Contact details: OMITTED${omissionReason ? ` — ${omissionReason.replace(/^Contact columns omitted: /, "")}` : " — not requested"}`,
    ];

    const csv = [
      ...header,
      columns.join(","),
      ...list.map((r) => columns.map((c) => csvCell(r[c])).join(",")),
    ].join("\n");

    const path = `${userId}/${jobId}.csv`;
    const up = await s.storage
      .from(EXPORT_BUCKET)
      .upload(path, new Blob([csv], { type: "text/csv;charset=utf-8" }), {
        contentType: "text/csv;charset=utf-8",
        upsert: true,
      });
    if (up.error) throw new Error(up.error.message);

    await s
      .from("export_jobs")
      .update({
        status: "completed",
        row_count: list.length,
        contact_included: includeContact,
        contact_omission_reason: includeContact ? null : omissionReason,
        storage_bucket: EXPORT_BUCKET,
        storage_path: path,
        data_freshness_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        error: null,
      })
      .eq("id", jobId);

    await s.from("audit_events").insert({
      actor_user_id: userId,
      action: "export_generated",
      entity_type: "export_job",
      entity_id: jobId,
      organization_id: filters.organization_id ?? null,
      after_state: {
        export_type: job.export_type,
        scope: job.scope_label,
        filters,
        row_count: list.length,
        contact_included: includeContact,
      } as never,
    });

    return { status: "completed" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    await s
      .from("export_jobs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", jobId);
    return { status: "failed", error: message };
  }
}

export async function listExportJobs(s: Any, userId: string): Promise<ExportJobRow[]> {
  const { data, error } = await s
    .from("export_jobs")
    .select("*")
    .eq("requested_by", userId)
    .order("requested_at", { ascending: false })
    .limit(25);
  if (error) throw new Error(error.message);

  const { data: profile } = await s
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  return ((data ?? []) as Any[]).map((r) => ({
    id: r.id,
    export_type: r.export_type,
    status: r.status,
    scope_label: r.scope_label ?? null,
    filters: (r.filters ?? {}) as Record<string, unknown>,
    row_count: r.row_count ?? null,
    contact_included: r.contact_included === true,
    contact_omission_reason: r.contact_omission_reason ?? null,
    requested_at: r.requested_at,
    completed_at: r.completed_at ?? null,
    error: r.error ?? null,
    requester_name: (profile?.full_name as string) ?? null,
    downloadable: r.status === "completed" && Boolean(r.storage_path),
  }));
}

export async function signExportDownload(
  s: Any,
  jobId: string,
  userId: string,
): Promise<{ url: string }> {
  const { data: job, error } = await s
    .from("export_jobs")
    .select("requested_by,status,storage_bucket,storage_path")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!job || job.requested_by !== userId) throw new Error("forbidden");
  if (job.status !== "completed" || !job.storage_path) throw new Error("Export is not ready yet.");

  const signed = await s.storage
    .from(job.storage_bucket ?? EXPORT_BUCKET)
    .createSignedUrl(job.storage_path, DOWNLOAD_TTL_SECONDS);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message ?? "Could not create download link.");
  }

  await s.from("audit_events").insert({
    actor_user_id: userId,
    action: "export_downloaded",
    entity_type: "export_job",
    entity_id: jobId,
    after_state: { at: new Date().toISOString() } as never,
  });

  return { url: signed.data.signedUrl };
}
