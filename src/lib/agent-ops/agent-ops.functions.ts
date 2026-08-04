/**
 * Agent Operations Console — server-function boundary.
 *
 * Thin wrappers only: authorization and data work live in
 * `agent-ops.server.ts`, which is loaded inside each handler so the
 * server-only module never enters a client bundle. Every control requires a
 * written reason, which is what lands in the audit trail.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AGENT_KEYS } from "@/lib/agents/registry";
import { RUN_BUCKETS } from "./agent-ops";

const reason = z.string().trim().min(8, "Say why, in a few words — it goes in the audit trail.").max(400);
const uuid = z.string().uuid();

const filtersSchema = z.object({
  bucket: z.enum(["all", ...(RUN_BUCKETS as unknown as [string, ...string[]])]).optional(),
  agent: z.enum(["all", ...(AGENT_KEYS as [string, ...string[]])]).optional(),
  organization_id: uuid.nullable().optional(),
  window_hours: z.number().int().min(1).max(336).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export const getAgentOpsConsole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtersSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const m = await import("./agent-ops.server");
    const operator = await m.requireOperator(context.userId);
    return m.loadAgentOpsConsole(operator, data as never);
  });

export const getAgentRunDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ job_id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const m = await import("./agent-ops.server");
    const operator = await m.requireOperator(context.userId);
    return m.loadAgentRunDetail(operator, data.job_id);
  });

export const getAssignableOperators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const m = await import("./agent-ops.server");
    await m.requireOperator(context.userId);
    return m.loadAssignableOperators();
  });

export const retryAgentRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ job_id: uuid, reason }).parse(input))
  .handler(async ({ data, context }) => {
    const m = await import("./agent-ops.server");
    const operator = await m.requireOperatorAdmin(context.userId);
    return m.retryAgentRun(operator, data);
  });

export const cancelAgentRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ job_id: uuid, reason }).parse(input))
  .handler(async ({ data, context }) => {
    const m = await import("./agent-ops.server");
    const operator = await m.requireOperatorAdmin(context.userId);
    return m.cancelAgentRun(operator, data);
  });

export const setAgentPausedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organization_id: uuid,
        agent_key: z.enum(AGENT_KEYS as [string, ...string[]]),
        paused: z.boolean(),
        reason,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const m = await import("./agent-ops.server");
    const operator = await m.requireOperatorAdmin(context.userId);
    return m.setAgentPaused(operator, data as never);
  });

export const escalateAgentRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ job_id: uuid, reason, assignee_user_id: uuid.nullable().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const m = await import("./agent-ops.server");
    const operator = await m.requireOperator(context.userId);
    return m.escalateAgentRun(operator, data);
  });

export const reassignAgentRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ job_id: uuid, assignee_user_id: uuid, reason }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const m = await import("./agent-ops.server");
    const operator = await m.requireOperatorAdmin(context.userId);
    return m.reassignAgentRun(operator, data);
  });
