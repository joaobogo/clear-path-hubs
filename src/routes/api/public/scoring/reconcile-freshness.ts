import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readJsonWithLimit } from "@/lib/public-api/body-limit";
import {
  PUBLIC_BODY_LIMITS,
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";
import { requireCronSecret } from "@/lib/public-api/cron-auth";

/**
 * Nightly score-freshness reconciliation. Queues a rescore for every match whose
 * score has been invalidated, capped per run, with one audit event per queued job.
 * Auth: the server-only CRON_INVOKE_SECRET in the `x-cron-secret` header.
 */
const schema = z
  .object({
    limit: z.number().int().min(1).max(200).optional(),
    dry_run: z.boolean().optional(),
  })
  .strict();

export const Route = createFileRoute("/api/public/scoring/reconcile-freshness")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        const denied = requireCronSecret(request);
        if (denied) return denied;

        const read = await readJsonWithLimit(request, PUBLIC_BODY_LIMITS.pipeline_run);
        if (!read.ok) {
          return Response.json({ ok: false, error: read.error, ...read.detail }, { status: read.status });
        }
        const parsed = schema.safeParse(read.body ?? {});
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ ok: false, error: "bad_request", detail: parsed.error.flatten() }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const { reconcileScoreFreshness, scanScoringGuardrails } = await import(
            "@/lib/scoring/freshness-reconcile.server"
          );
          const out = await reconcileScoreFreshness({
            limit: parsed.data.limit,
            dryRun: parsed.data.dry_run,
          });
          // The guardrail health check rides along: counts only, never a write.
          let guardrails: Record<string, number> | null = null;
          try {
            const g = await scanScoringGuardrails();
            guardrails = {
              ineligible_without_failed_check: g.ineligible_without_failed_check.length,
              unscored_without_task: g.unscored_without_task.length,
              positions_with_protected_wording: g.positions_with_protected_wording.length,
              outdated_engine_scores: g.outdated_engine_scores.length,
            };
            if (Object.values(guardrails).some((n) => n > 0)) {
              console.warn("[reconcile-freshness] scoring guardrails flagged", guardrails);
            }
          } catch (err) {
            console.error("[reconcile-freshness] guardrail scan failed", (err as Error)?.message);
          }
          return Response.json({ ok: true, ...out, guardrails });
        } catch (err) {
          console.error("[reconcile-freshness] failed", (err as Error)?.message);
          return new Response(
            JSON.stringify({ ok: false, error: "reconcile_failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
