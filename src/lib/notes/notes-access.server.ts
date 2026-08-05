// Server-only access layer for structured notes: staff gate, admin client, audit.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export {
  listStructuredNotes,
  addStructuredNote,
  editStructuredNote,
} from "./structured-notes.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export async function staffClient(): Promise<AnyClient> {
  return supabaseAdmin as unknown as AnyClient;
}

export async function requireStaff(userId: string): Promise<void> {
  const s = await staffClient();
  const { data } = await s.rpc("is_platform_staff", { _user: userId });
  if (data !== true) throw new Error("forbidden");
}

export async function writeNoteAudit(
  s: AnyClient,
  opts: {
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    organizationId: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await s.from("audit_events").insert({
    actor_user_id: opts.actor,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId,
    organization_id: opts.organizationId,
    before_state: (opts.before ?? null) as never,
    after_state: (opts.after ?? null) as never,
  });
}
