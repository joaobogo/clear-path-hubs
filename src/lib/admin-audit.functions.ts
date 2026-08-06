/**
 * One paginated audit reader for the three admin detail pages.
 *
 * Each page used to fetch its own slice of `audit_events` with a hard `limit`
 * and no way to see anything older, and each rendered the actor as a truncated
 * UUID. This reads a page at a time, resolves the actor to a name, and pulls
 * any reason text out of the event payload so the trail answers "who did what,
 * when, and why" without a database console.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AuditEntity = "candidate" | "position" | "client";

export type RecordAuditRow = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  actor_user_id: string | null;
  /** Display name when the actor is a known user, "System" for automation. */
  actor_name: string;
  /** Reason captured with the decision, when the writer recorded one. */
  reason: string | null;
  trace_id: string | null;
};

export type RecordAuditPage = {
  rows: RecordAuditRow[];
  /** Total matching events, so the UI can say "25 of 312". */
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
};

const input = z.object({
  entity: z.enum(["candidate", "position", "client"]),
  /** Match id for candidates, position id, or organization id. */
  id: z.string().uuid(),
  limit: z.number().int().min(1).max(100).optional().default(25),
  offset: z.number().int().min(0).optional().default(0),
});

export const getRecordAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<RecordAuditPage> => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (isStaff !== true) throw new Error("Forbidden: platform staff required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadRecordAudit } = await import("@/lib/admin-audit.server");
    return loadRecordAudit(supabaseAdmin, data);
  });
