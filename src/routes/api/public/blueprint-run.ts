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
 * Runs (or retries) the Role Blueprint preparation for one express intake.
 *
 * Public by URL but safe by construction: it takes only an intake id, does no
 * reads back to the caller beyond a status, and refuses to run twice — the
 * first caller claims the job by moving the position out of 'queued'.
 */

const bodySchema = z.object({ intakeId: z.string().uuid() });

export const Route = createFileRoute("/api/public/blueprint-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = newTraceId("blueprint_run");
        const decision = consumeRateLimit("blueprint_run", clientIp(request), PUBLIC_RATE_LIMITS.blueprint_run);
        if (decision.limited) return rateLimitResponse(traceId, decision);

        const read = await readJsonWithLimit(request, PUBLIC_BODY_LIMITS.blueprint_run);
        if (!read.ok) {
          return Response.json(
            { ok: false, trace_id: traceId, error: read.error, ...read.detail },
            { status: read.status },
          );
        }
        const parsed = bodySchema.safeParse(read.body);
        if (!parsed.success) return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const { data: intake } = await admin
          .from("intake_submissions")
          .select("id, position_id")
          .eq("id", parsed.data.intakeId)
          .maybeSingle();
        if (!intake || !intake.position_id) {
          return Response.json({ ok: false, error: "not_found" }, { status: 404 });
        }

        const { runBlueprintForPosition } = await import("@/lib/blueprint-pipeline.server");
        const result = await runBlueprintForPosition(intake.position_id);

        return Response.json({ ok: result.ok, reason: result.reason ?? null });
      },
    },
  },
});
