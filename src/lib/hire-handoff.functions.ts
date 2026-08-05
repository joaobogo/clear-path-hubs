// Thin server-function wrappers for the post-hire handoff view.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HANDOFF_STEP_KEYS, type PositionHandoff } from "@/lib/hire-handoff";

/** The handoff for one role. Null when no hire has been confirmed on it. */
export const getPositionHandoff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ orgId: z.string().uuid(), positionId: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }): Promise<PositionHandoff | null> => {
    const { assertWorkspaceArea } = await import("@/lib/collaborator-roles.server");
    await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "candidates");
    const { loadPositionHandoff } = await import("@/lib/hire-handoff.server");
    return loadPositionHandoff(context.supabase, data);
  });

/** Marks a remaining step complete, or reopens it. */
export const setHandoffStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        orgId: z.string().uuid(),
        positionId: z.string().uuid(),
        stepKey: z.enum(HANDOFF_STEP_KEYS),
        done: z.boolean(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertWorkspaceArea } = await import("@/lib/collaborator-roles.server");
    await assertWorkspaceArea(context.supabase, context.userId, data.orgId, "role_settings");
    const { HANDOFF_STEP_SPECS } = await import("@/lib/hire-handoff");
    const { loadPositionHandoff, setHandoffStepDone } = await import("@/lib/hire-handoff.server");

    const handoff = await loadPositionHandoff(context.supabase, {
      orgId: data.orgId,
      positionId: data.positionId,
    });
    if (!handoff) throw new Error("This role does not have a confirmed hire.");
    const step = handoff.steps.find((s) => s.key === data.stepKey);
    if (!step) throw new Error("That step is not part of your plan for this role.");
    const spec = HANDOFF_STEP_SPECS.find((s) => s.key === data.stepKey)!;

    return setHandoffStepDone(context.supabase, {
      orgId: data.orgId,
      positionId: data.positionId,
      hireId: handoff.hire_id,
      stepKey: spec.key,
      label: spec.label,
      sequence: spec.sequence,
      ownerLabel: step.owner_name,
      planLabel: handoff.plan_label,
      done: data.done,
      actorUserId: context.userId,
    });
  });
