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

/**
 * Nightly score-freshness reconciliation. Queues a rescore for every match whose
 * score has been invalidated, capped per run, with one audit event per queued job.
 * Auth: the project's publishable key in the `apikey` header (canonical cron pattern).
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

        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

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
          const { reconcileScoreFreshness } = await import(
            "@/lib/scoring/freshness-reconcile.server"
          );
          const out = await reconcileScoreFreshness({
            limit: parsed.data.limit,
            dryRun: parsed.data.dry_run,
          });
          return Response.json({ ok: true, ...out });
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
