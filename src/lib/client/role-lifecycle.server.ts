// Server-only implementation for the client-facing role states: sourcing,
// paused and archived. Nothing is deleted — only the role's status moves, so
// candidates already delivered stay exactly where they are.
//
// The previous status is returned so the UI can offer a real Undo instead of a
// second guess at where the role came from.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export const CLIENT_ROLE_STATES = ["active", "paused", "archived"] as const;
export type ClientRoleState = (typeof CLIENT_ROLE_STATES)[number];

export type SetRoleStateResult = {
  id: string;
  status: string;
  previousStatus: string;
};

export async function runSetRoleState(input: {
  userId: string;
  positionId: string;
  state: ClientRoleState;
}): Promise<SetRoleStateResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const s = supabaseAdmin as unknown as AnyRow;

  const { data: pos, error: readError } = await s
    .from("positions")
    .select("id, status, organization_id, published_at, visibility, title")
    .eq("id", input.positionId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!pos) throw new Error("We couldn't find this role.");

  const { assertWorkspaceWrite } = await import("@/lib/authz/workspace-access");
  await assertWorkspaceWrite(s, input.userId, pos.organization_id as string);

  const previousStatus = String(pos.status ?? "");
  if (previousStatus === input.state) {
    return { id: input.positionId, status: previousStatus, previousStatus };
  }

  const now = new Date().toISOString();
  const patch: AnyRow = { status: input.state };
  if (input.state === "active") {
    if (!pos.published_at) patch.published_at = now;
    // Resuming a role never silently un-publishes it.
    patch.closed_at = null;
  }

  const { data: updated, error } = await s
    .from("positions")
    .update(patch)
    .eq("id", input.positionId)
    .select("id,status")
    .maybeSingle();
  if (error) throw new Error(error.message);

  try {
    await s.from("audit_events").insert({
      actor_user_id: input.userId,
      action: `position.client_${input.state}`,
      entity_type: "position",
      entity_id: input.positionId,
      organization_id: pos.organization_id,
      before_state: { status: previousStatus } as never,
      after_state: { status: input.state } as never,
    });
  } catch (err) {
    console.error("[role-lifecycle] audit insert failed", err);
  }

  return {
    id: input.positionId,
    status: String(updated?.status ?? input.state),
    previousStatus,
  };
}
