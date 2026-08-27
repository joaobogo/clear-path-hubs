import { createFileRoute } from "@tanstack/react-router";

/**
 * Drains stuck blueprint jobs. Called by a scheduled pg_cron job every few
 * minutes so roles created without a running pipeline (legacy drafts, skipped
 * intakes, retries that failed before the fix) eventually complete.
 *
 * Protected by a shared secret in the Authorization header. The endpoint
 * returns only a summary, not position data.
 */

export const Route = createFileRoute("/api/public/blueprint-drain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Fail CLOSED, like every other scheduler endpoint. The old check was
        // `if (secret && ...)`: with BLUEPRINT_DRAIN_SECRET unset this was an
        // unauthenticated public POST that burns LLM budget on up to 25
        // positions per call — an unconfigured environment silently became an
        // open endpoint, which is the exact failure cron-auth.ts documents.
        // The suffix match (`auth.endsWith(secret)`) also was not
        // constant-time; requireCronSecret is. The scheduler presents
        // CRON_INVOKE_SECRET like every other cron route, so ops has one
        // secret to manage instead of a second one that can drift.
        const { requireCronSecret } = await import("@/lib/public-api/cron-auth");
        const denied = requireCronSecret(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        // Positions stuck in a non-terminal blueprint state for more than 5
        // minutes are candidates for a drain. Never touch 'ready' or
        // 'confirmed' roles.
        const { data: stuck } = await admin
          .from("positions")
          .select("id, blueprint_status, blueprint_attempts")
          .or("blueprint_status.in.(queued,failed,not_started),blueprint_status.is.null")
          .lt("updated_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .limit(25);

        const results: { id: string; status: string; result: string }[] = [];
        for (const row of stuck ?? []) {
          if ((row.blueprint_attempts ?? 0) >= 5) {
            results.push({ id: row.id, status: row.blueprint_status, result: "attempts_exhausted" });
            continue;
          }
          const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
          try {
            const res = await runBlueprintForPosition(row.id);
            results.push({ id: row.id, status: res.status ?? row.blueprint_status, result: res.ok ? "started" : res.reason ?? "no_change" });
          } catch (err) {
            results.push({ id: row.id, status: row.blueprint_status, result: String(err) });
          }
        }

        return Response.json({ ok: true, drained: results.length, results });
      },
    },
  },
});
