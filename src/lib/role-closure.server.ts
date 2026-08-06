// Role closure — server-only reader.
// Shared by the thin server-function wrapper and the single role-detail payload.
import {
  CLOSE_REASON_LABEL,
  isCloseReason,
  type RoleClosureSummary,
} from "@/lib/role-closure";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function loadRoleClosure(
  supabase: Client,
  data: { orgId: string; positionId: string },
): Promise<RoleClosureSummary | null> {
    const { data: row, error } = await supabase
      .from("positions")
      .select("id, status, closure_reason, closure_note, closed_at, closed_by, restart_expected_on")
      .eq("id", data.positionId)
      .eq("organization_id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;

    const reason = (row as { closure_reason: string | null }).closure_reason;
    if (!isCloseReason(reason)) return null;

    let closedByName: string | null = null;
    const closedBy = (row as { closed_by: string | null }).closed_by;
    if (closedBy) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", closedBy)
        .maybeSingle();
      const p = profile as { full_name: string | null; email: string | null } | null;
      closedByName = p?.full_name?.trim() || p?.email || null;
    }

    const r = row as {
      status: string;
      closure_note: string | null;
      closed_at: string | null;
      restart_expected_on: string | null;
    };
    return {
      reason,
      reasonLabel: CLOSE_REASON_LABEL[reason],
      note: r.closure_note,
      closedAt: r.closed_at,
      closedByName,
      restartExpectedOn: r.restart_expected_on,
      paused: r.status === "paused",
    };
}
