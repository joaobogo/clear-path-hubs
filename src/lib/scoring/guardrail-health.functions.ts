import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Scoring guardrail counts for the admin data-health page. Staff only; reads only. */
export const getScoringGuardrails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await supabase.rpc("is_platform_staff", { _user: userId });
    if (!staff) throw new Error("Staff access required.");
    const { scanScoringGuardrails } = await import("./freshness-reconcile.server");
    const { guardrailRows } = await import("./guardrail-health");
    const report = await scanScoringGuardrails();
    return {
      generated_at: report.generated_at,
      rows: guardrailRows(report),
      positions_with_protected_wording: report.positions_with_protected_wording.slice(0, 20),
    };
  });
