/**
 * Publish gate reads. Server-only: uses the service-role client passed in by
 * the caller, and reuses `evaluatePublishGate` so the queue and the publish
 * action always agree.
 */
import {
  evaluatePublishGate,
  publishBlockedMessage,
  type PublishBlocker,
  type PublishGateInput,
} from "./publish-gate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const SELECT =
  "id, title, status, visibility, payment_status, approved_at, published_at, created_at, submitted_at, owner_user_id, organization_id, description, employment_type, work_model, seniority, location, requirements";

/** Statuses where publishing is still the next meaningful step. */
const UNPUBLISHED_STATUSES = ["draft", "submitted", "under_review", "needs_clarification", "approved"];

export type PublishGateRow = {
  position_id: string;
  title: string;
  organization_id: string;
  organization_name: string;
  status: string;
  payment_status: string | null;
  payment_satisfied: boolean;
  published_at: string | null;
  publish_ready_at: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  blockers: PublishBlocker[];
  can_publish: boolean;
  is_test_record: boolean;
};

function toGateInput(p: Any): PublishGateInput {
  return {
    status: p['status'] ?? null,
    payment_status: p['payment_status'] ?? null,
    approved_at: p['approved_at'] ?? null,
    published_at: p['published_at'] ?? null,
    title: p['title'] ?? null,
    description: p['description'] ?? null,
    employment_type: p['employment_type'] ?? null,
    work_model: p['work_model'] ?? null,
    seniority: p['seniority'] ?? null,
    location: p['location'] ?? null,
    requirements: p['requirements'] ?? null,
  };
}

/**
 * Throws when a position must not go live. Called by the publish action itself,
 * so nothing in the UI can talk its way past it. `not_approved` is a workflow
 * marker rather than a hard gate — staff may approve-and-activate in one step.
 */
export async function assertPositionPublishable(admin: Any, positionId: string): Promise<void> {
  const { data, error } = await admin.from("positions").select(SELECT).eq("id", positionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("position_not_found");
  const blockers = evaluatePublishGate(toGateInput(data)).filter((b) => b !== "not_approved");
  if (blockers.length > 0) throw new Error(publishBlockedMessage(blockers));
}

export async function loadPublishGateQueue(
  admin: Any,
  opts: { includeTest?: boolean; q?: string } = {},
): Promise<{ rows: PublishGateRow[]; total_unpublished: number }> {
  // Drive the blueprint pipeline for any roles stuck in 'queued' for > 2 minutes
  // in case the initial trigger or runner missed them.
  try {
    const twoMinsAgo = new Date(Date.now() - 120 * 1000).toISOString();
    const { data: stuck } = await admin
      .from("positions")
      .select("id")
      .eq("blueprint_status", "queued")
      .lt("updated_at", twoMinsAgo)
      .limit(5);

    if (stuck && stuck.length > 0) {
      const { retryBlueprintAnalysis } = await import("./blueprint.functions");
      // Run sequentially but without awaiting to avoid blocking the UI response
      stuck.forEach((p: { id: string }) => {
        retryBlueprintAnalysis({ data: { positionId: p.id } }).catch(console.error);
      });
    }
  } catch (err) {
    console.error("[publish-gate] stuck recovery failed", err);
  }

  const { loadTestScope } = await import("./admin-test-scope.server");
  const scope = await loadTestScope(admin, opts.includeTest ?? false);

  let q = admin
    .from("positions")
    .select(`${SELECT}, organizations(id, name, is_test_record)`)
    .in("status", UNPUBLISHED_STATUSES)
    .order("created_at", { ascending: true })
    .limit(300);
  if (scope.orgIds.length > 0) q = q.not("organization_id", "in", `(${scope.orgIds.join(",")})`);
  if (opts.q) {
    const { buildPositionSearchOr } = await import("./search/postgrest-filter");
    const searchOr = await buildPositionSearchOr(admin as never, opts.q);
    if (searchOr) q = q.or(searchOr);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const positions = (data ?? []) as Any[];
  const ownerIds = [...new Set(positions.map((p) => p['owner_user_id']).filter(Boolean))] as string[];
  const owners = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("auth_user_id, full_name")
      .in("auth_user_id", ownerIds);
    for (const p of (profiles ?? []) as Any[]) owners.set(p['auth_user_id'], p['full_name'] ?? "");
  }

  const rows: PublishGateRow[] = positions.map((p) => {
    const gate = toGateInput(p);
    const blockers = evaluatePublishGate(gate);
    const hard = blockers.filter((b) => b !== "not_approved");
    return {
      position_id: p['id'],
      title: p['title'] ?? "Untitled role",
      organization_id: p['organization_id'],
      organization_name: p['organizations']?.name ?? "Unknown client",
      status: String(p['status']),
      payment_status: p['payment_status'] ?? null,
      payment_satisfied: !blockers.includes("payment_unpaid"),
      published_at: p['published_at'] ?? null,
      publish_ready_at: hard.length === 0 ? (p['approved_at'] ?? p['submitted_at'] ?? null) : null,
      owner_user_id: p['owner_user_id'] ?? null,
      owner_name: p['owner_user_id'] ? (owners.get(p['owner_user_id']) || null) : null,
      blockers,
      can_publish: blockers.length === 0,
      is_test_record: Boolean(p['organizations']?.is_test_record),
    };
  });

  // Blocked roles first, then longest-waiting.
  rows.sort((a, b) => Number(a.can_publish) - Number(b.can_publish));

  return { rows, total_unpublished: rows.length };
}
