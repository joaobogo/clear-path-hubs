/**
 * Server-only summary of a candidate's OWN existing application, used when
 * someone applies to a role they have already applied to. It discloses only
 * that candidate's application: date, plain-English status, reference, and
 * whether the CV can still be replaced. Never a duplicate error, never
 * another candidate's data, never internal scores or notes.
 */
import { resolveCandidateState, type StatusInputs } from "./apply-status-model";
import { CANDIDATE_STATES, type CandidateStateKey } from "./candidate-transparency";

export interface ExistingApplicationSummary {
  application_id: string;
  reference: string;
  applied_at: string;
  /** Plain-English state key shared with the public status page. */
  state: CandidateStateKey;
  status_label: string;
  status_meaning: string;
  /** What is happening on our side, in one line. */
  status_happening: string;
  position_title: string | null;
  organization_name: string | null;
  cv_filename: string | null;
  /** A replacement CV is only useful while a decision has not been made. */
  can_replace_cv: boolean;
  tracking_path: string;
}

function ref6(id: string): string {
  return id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

export async function loadExistingApplicationSummary(
  applicationId: string,
): Promise<ExistingApplicationSummary | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: appRow, error } = await supabaseAdmin
    .from("applications")
    .select(
      "id,applied_at,created_at,status,withdrawn_at,cv_file_id," +
        "positions(title,status,organizations(name))," +
        "candidate_matches(stage,client_visibility)",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (error || !appRow) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const app = appRow as any;

  const pos = app.positions as unknown as {
    title?: string | null;
    status?: string | null;
    organizations?: { name?: string | null } | null;
  } | null;
  const matchesRaw = app.candidate_matches as unknown;
  const matches = (Array.isArray(matchesRaw) ? matchesRaw : matchesRaw ? [matchesRaw] : []) as Array<{
    stage: string | null;
    client_visibility: string | null;
  }>;
  let cvFilename: string | null = null;
  if (app.cv_file_id) {
    const { data: f } = await supabaseAdmin
      .from("files")
      .select("filename")
      .eq("id", app.cv_file_id as string)
      .maybeSingle();
    cvFilename = (f?.filename as string | null) ?? null;
  }

  const { data: openReqs } = await supabaseAdmin
    .from("candidate_info_requests")
    .select("id")
    .eq("application_id", app.id)
    .eq("status", "open")
    .limit(1);

  const inputs: StatusInputs = {
    applicationStatus: app.status as string,
    withdrawnAt: (app.withdrawn_at as string | null) ?? null,
    positionStatus: pos?.status ?? null,
    matchStage: matches[0]?.stage ?? null,
    matchVisible: matches.some((m) => m.client_visibility === "visible"),
    hasOpenInfoRequest: (openReqs ?? []).length > 0,
    interviewScheduled: false,
    interviewRequested: false,
    needsSupport: false,
  };
  const state = resolveCandidateState(inputs);
  const copy = CANDIDATE_STATES[state];

  return {
    application_id: app.id as string,
    reference: ref6(app.id as string),
    applied_at: (app.applied_at as string | null) ?? (app.created_at as string),
    state,
    status_label: copy.label,
    status_meaning: copy.meaning,
    status_happening: copy.happening,
    position_title: pos?.title ?? null,
    organization_name: pos?.organizations?.name ?? null,
    cv_filename: cvFilename,
    can_replace_cv:
      state !== "decision_made" && state !== "withdrawn" && state !== "role_closed",
    tracking_path: `/apply/received/${app.id}`,
  };
}
