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
        const { drainStuckBlueprints } = await import("@/lib/blueprint-drain.server");
        // Includes runs stuck "in progress" whose request was dropped — the
        // old query only looked at queued/failed/not_started, so those were
        // never recovered.
        const results = await drainStuckBlueprints(supabaseAdmin, 25);

        return Response.json({ ok: true, drained: results.length, results });
      },
    },
  },
});
