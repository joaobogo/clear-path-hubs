// Thin server-function wrappers for pilot eligibility — platform staff only.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type RepeatPilotAttempt = {
  id: string;
  organization_id: string | null;
  organization_name: string | null;
  position_id: string | null;
  intake_submission_id: string | null;
  company_name: string;
  company_domain: string | null;
  email_domain: string | null;
  contact_email: string | null;
  blocked_reason: string | null;
  blocked_line: string;
  first_claim: {
    id: string;
    company_name: string;
    organization_id: string | null;
    organization_name: string | null;
    created_at: string;
  } | null;
  exception_granted: boolean;
  exception_kind: string | null;
  exception_reason: string | null;
  created_at: string;
};

/** Repeat pilot attempts staff need to look at. Newest first. */
export const listPilotWarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        organization_id: z.string().uuid().nullable().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<RepeatPilotAttempt[]> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPilotWarnings } = await import("./pilot-eligibility-admin.server");
    return loadPilotWarnings(supabaseAdmin as never, {
      organizationId: data.organization_id ?? null,
      limit: data.limit ?? 25,
    });
  });

/**
 * Grant a pilot to a company that already used one — only for a genuinely
 * separate hiring entity (location, franchise, subsidiary). Recorded with the
 * reason and the person who approved it.
 */
export const grantPilotException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        claim_id: z.string().uuid(),
        kind: z.enum(["multi_location", "franchise", "subsidiary", "other"]),
        reason: z.string().trim().min(10, "Give a reason of at least 10 characters").max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { grantException } = await import("./pilot-eligibility-admin.server");
    return grantException(supabaseAdmin as never, {
      claimId: data.claim_id,
      kind: data.kind,
      reason: data.reason,
      actorUserId: context.userId,
    });
  });
