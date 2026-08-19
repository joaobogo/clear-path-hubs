/**
 * Exception digest for the admin shell.
 *
 * Counts come from the same loaders the source screens use, so the header can
 * never disagree with the page it links to. Each category is loaded
 * independently and a failure is reported as `unavailable` — never as zero.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DigestKey =
  | "sla_breaches"
  | "processing_exceptions"
  | "integration_degradations"
  | "approvals_pending"
  | "delivery_failures";

export type DigestEntry = {
  key: DigestKey;
  label: string;
  /** Null when the count could not be read. Never coerce this to 0. */
  count: number | null;
  status: "ok" | "unavailable";
  to: string;
};

export type ExceptionDigest = {
  entries: DigestEntry[];
  generated_at: string;
};

export const DIGEST_META: Record<DigestKey, { label: string; to: string }> = {
  sla_breaches: { label: "SLA breaches", to: "/admin/sla" },
  processing_exceptions: { label: "Processing exceptions", to: "/admin/operations" },
  integration_degradations: { label: "Integration degradations", to: "/admin/integrations" },
  approvals_pending: { label: "Approvals pending", to: "/admin/approvals" },
  delivery_failures: { label: "Delivery failures (7d)", to: "/admin/notifications" },
};

export const getExceptionDigest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExceptionDigest> => {
    const { requireStaff } = await import("./admin-ops.server");
    await requireStaff(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as never;

    const settle = async (key: DigestKey, read: () => Promise<number>): Promise<DigestEntry> => {
      const meta = DIGEST_META[key];
      try {
        return { key, label: meta.label, to: meta.to, count: await read(), status: "ok" };
      } catch (e) {
        console.error(`[exception-digest] ${key} failed`, e);
        return { key, label: meta.label, to: meta.to, count: null, status: "unavailable" };
      }
    };

    const entries = await Promise.all([
      settle("sla_breaches", async () => {
        const { loadSlaBreaches } = await import("./admin-sla-breach.server");
        return (await loadSlaBreaches(admin, { includeTest: false })).rows.length;
      }),
      settle("processing_exceptions", async () => {
        const { loadExceptionBoard } = await import("./admin-processing-exceptions.server");
        const board = await loadExceptionBoard(admin);
        return board.active.length + board.scoring_orphans;
      }),
      settle("integration_degradations", async () => {
        const { loadIntegrationStrip } = await import("./integration-strip.server");
        const strip = await loadIntegrationStrip(admin);
        return strip.chips.filter((c) => c.state === "degraded" || c.state === "failing").length;
      }),
      settle("approvals_pending", async () => {
        const { loadApprovals } = await import("./admin-approvals.server");
        return (await loadApprovals(admin, { includeTest: false })).total;
      }),
      settle("delivery_failures", async () => {
        const { loadDeliveryFailures } = await import("./notification-failures.server");
        const failures = await loadDeliveryFailures(admin);
        return failures.items.length;
      }),
    ]);

    return { entries, generated_at: new Date().toISOString() };
  });
