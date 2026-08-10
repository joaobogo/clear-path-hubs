// Public pipeline runner endpoint.
// Auth: requires the Supabase publishable key in `apikey` header (matches
// the canonical /api/public/* auth pattern). This is a public URL only so
// that pg_cron and the fire-and-forget internal caller can reach it — the
// key gate keeps the outside world out.
//
// Body:
//   { match_id: uuid }   → run pipeline for that match
//   { drain: true }      → drain queued/stuck matches (used by cron)
//   { }                  → equivalent to drain: true, limit 5

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { readJsonWithLimit } from "@/lib/public-api/body-limit";
import { PUBLIC_BODY_LIMITS } from "@/lib/public-api/rate-limit";
import {
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";

const schema = z.union([
  z.object({ match_id: z.string().uuid(), force: z.boolean().optional() }),
  z.object({ drain: z.literal(true), limit: z.number().int().min(1).max(25).optional() }),
  z.object({}).strict(),
]);

export const Route = createFileRoute("/api/public/pipeline/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronDecision = consumeRateLimit("cron_invoke", clientIp(request), PUBLIC_RATE_LIMITS.cron_invoke);
        if (cronDecision.limited) return rateLimitResponse(newTraceId("cron_invoke"), cronDecision);

        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided = request.headers.get("apikey") ?? "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const read = await readJsonWithLimit(request, PUBLIC_BODY_LIMITS.pipeline_run);
        if (!read.ok) {
          return Response.json({ ok: false, error: read.error, ...read.detail }, { status: read.status });
        }
        const parsed = schema.safeParse(read.body ?? {});
        if (!parsed.success) {
          return new Response(JSON.stringify({ ok: false, error: "bad_request", detail: parsed.error.flatten() }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }
        const { runPipelineForMatch, drainQueue } = await import("@/lib/pipeline-runner.server");
        if ("match_id" in parsed.data) {
          const out = await runPipelineForMatch(parsed.data.match_id, { force: parsed.data.force });
          return Response.json({ ok: true, outcome: out });
        }
        const out = await drainQueue({ limit: "limit" in parsed.data ? parsed.data.limit : 5 });
        return Response.json({ ok: true, ...out });
      },
    },
  },
});
