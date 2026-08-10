import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CANDIDATE_FUNNEL_EVENT_NAMES,
  type CandidateFunnelContext,
  type CandidateFunnelEvent,
} from "./funnel-events";
import { throttlePublicFn } from "../public-api/server-fn-guard";

const contextSchema = z
  .object({
    position_id: z.string().uuid().optional(),
    reference: z.string().trim().max(12).optional(),
    step: z.string().trim().max(40).optional(),
    device: z.enum(["phone", "tablet", "desktop"]).optional(),
    reason: z.string().trim().max(40).optional(),
    category: z.string().trim().max(40).optional(),
  })
  .strict();

const inputSchema = z.object({
  event: z.enum(CANDIDATE_FUNNEL_EVENT_NAMES as [string, ...string[]]),
  context: contextSchema.optional(),
});

/**
 * Records one candidate funnel event. Deliberately unauthenticated: the public
 * job page and the apply flow are the two places where drop-off happens, and
 * both are reachable without a session. The event name is constrained to a
 * fixed catalogue and the payload is a strict allow-list of non-identifying
 * fields, so there is nothing here an anonymous caller can inject.
 */
export const trackCandidateEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    throttlePublicFn("candidate_event");
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_events").insert({
        action: `candidate_funnel.${data.event}`,
        entity_type: "candidate_funnel",
        entity_id: data.context?.position_id ?? null,
        after_state: { event: data.event, ...(data.context ?? {}) },
      });
    } catch (err) {
      // Instrumentation never breaks the flow it observes.
      console.error("[candidate-funnel] emit failed", err);
    }
    return { ok: true as const };
  });

/** Fire-and-forget helper for components. Never awaits, never throws. */
export function track(event: CandidateFunnelEvent, context?: CandidateFunnelContext) {
  void trackCandidateEvent({ data: { event, context } }).catch(() => {});
}
