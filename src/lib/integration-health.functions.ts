import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DetailsMap } from "@/lib/integration-health.server";

/**
 * Admin integration health: run read-only probes against Stripe, Attio,
 * Calendly and email delivery, record every result, and read back the latest
 * result plus recent history per integration.
 */

const INTEGRATIONS = ["stripe", "attio", "calendly", "email"] as const;
export type IntegrationId = (typeof INTEGRATIONS)[number];

export type IntegrationCheckRow = {
  id: string;
  integration: IntegrationId;
  status: "ok" | "degraded" | "failed" | "not_configured";
  summary: string;
  error_code: string | null;
  error_detail: string | null;
  remediation: string | null;
  latency_ms: number | null;
  details: DetailsMap;
  created_at: string;
};

async function assertStaff(context: { supabase: { rpc: Function }; userId: string }) {
  const { data: staff } = await context.supabase.rpc("is_platform_staff", {
    _user: context.userId,
  });
  if (staff !== true) throw new Error("Forbidden");
}

export const getIntegrationHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as never);

    const { data, error } = await context.supabase
      .from("integration_health_checks")
      .select(
        "id, integration, status, summary, error_code, error_detail, remediation, latency_ms, details, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as IntegrationCheckRow[];
    const latest: Partial<Record<IntegrationId, IntegrationCheckRow>> = {};
    const history: Record<IntegrationId, IntegrationCheckRow[]> = {
      stripe: [],
      attio: [],
      calendly: [],
      email: [],
    };
    for (const row of rows) {
      if (!INTEGRATIONS.includes(row.integration)) continue;
      if (!latest[row.integration]) latest[row.integration] = row;
      if (history[row.integration].length < 10) history[row.integration].push(row);
    }

    return {
      integrations: INTEGRATIONS.map((id) => ({
        id,
        latest: latest[id] ?? null,
        history: history[id],
      })),
      generated_at: new Date().toISOString(),
    };
  });

export const runIntegrationChecks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ integrations: z.array(z.enum(INTEGRATIONS)).min(1).optional() })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertStaff(context as never);

    const ids = (data.integrations ?? [...INTEGRATIONS]) as IntegrationId[];
    const { runProbes } = await import("@/lib/integration-health.server");
    const results = await runProbes(ids);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("integration_health_checks").insert(
      results.map((r) => ({
        integration: r.integration,
        status: r.status,
        summary: r.summary,
        error_code: r.error_code,
        error_detail: r.error_detail,
        remediation: r.remediation,
        latency_ms: r.latency_ms,
        details: r.details as never,
        checked_by: context.userId,
      })) as never,
    );
    if (error) throw new Error(`Checks ran but could not be recorded: ${error.message}`);

    return { ran: results.length, results };
  });

export const getStripePaymentMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context as never);

    const { data, error } = await context.supabase
      .from("integration_health_checks")
      .select("details")
      .eq("integration", "stripe")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);

    const env =
      ((data?.[0] as IntegrationCheckRow | undefined)?.details?.environment as string) ?? null;
    return { mode: env === "live" ? "live" : env === "sandbox" ? "sandbox" : "unknown" };
  });
