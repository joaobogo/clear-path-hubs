import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUPPORT_BODY_MAX, SUPPORT_CATEGORIES, supportCategoryLabel } from "./support";

type AnyRow = {
  from: (table: string) => any;
};

const inputSchema = z.object({
  category: z.enum(
    SUPPORT_CATEGORIES.map((c) => c.key) as [string, ...string[]],
  ),
  body: z.string().trim().min(1).max(SUPPORT_BODY_MAX),
  /** Application reference the candidate was looking at, when there is one. */
  reference: z.string().trim().max(12).optional(),
});

/**
 * A candidate support request. Lands in the same ops message thread the
 * candidate already sees, with their reference and category attached, so the
 * person replying has the context without asking for it.
 */
export const submitSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as unknown as AnyRow;
    const header = `Support request — ${supportCategoryLabel(data.category)}${
      data.reference ? ` (ref ${data.reference})` : ""
    }`;
    const { error } = await supabase.from("messages").insert({
      sender_user_id: context.userId,
      body: `${header}\n\n${data.body}`,
      recipient_context: {
        audience: "taasflow_ops",
        from: "candidate",
        kind: "support_request",
        category: data.category,
        reference: data.reference ?? null,
      },
    });
    if (error) return { ok: false as const, message: error.message };

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_events").insert({
        action: "candidate_funnel.support_requested",
        entity_type: "candidate_funnel",
        actor_user_id: context.userId,
        after_state: {
          event: "support_requested",
          category: data.category,
          reference: data.reference ?? null,
        },
      });
    } catch {
      // Instrumentation is best-effort.
    }

    return { ok: true as const };
  });

/**
 * A request for a copy of everything we hold on the candidate. Recorded as an
 * auditable request and routed to ops — we never claim an instant export we
 * cannot honour.
 */
export const requestMyDataExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ note: z.string().trim().max(1000).optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as unknown as AnyRow;
    const { error } = await supabase.from("messages").insert({
      sender_user_id: context.userId,
      body: `Data export request${data.note ? `\n\n${data.note}` : ""}`,
      recipient_context: {
        audience: "taasflow_ops",
        from: "candidate",
        kind: "data_export_request",
      },
    });
    if (error) return { ok: false as const, message: error.message };

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_events").insert({
        action: "candidate_funnel.data_export_requested",
        entity_type: "candidate_funnel",
        actor_user_id: context.userId,
        after_state: { event: "data_export_requested" },
      });
    } catch {
      // Instrumentation is best-effort.
    }

    return { ok: true as const };
  });
