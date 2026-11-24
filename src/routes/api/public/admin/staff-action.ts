// Internal: run an admin screen's own server-function handler for a named
// platform-staff member, when that person cannot drive the screen themselves.
// Auth: the server-only PIPELINE_RUN_TOKEN (x-pipeline-run-token) or the
// scheduler's CRON_INVOKE_SECRET (x-cron-secret), as for the pipeline runner.
// The URL is public only so internal callers can reach it.
//
// Body: { actor_user_id, op, input }
//
// Each op is the exact handler the admin screen calls, with its own input
// validation, run with the actor as the caller, so records, audit events and
// notifications are the ones the screen produces. Only setup work is allowed:
// nothing here approves, activates or makes a role public.

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
import { requirePipelineRunToken } from "@/lib/public-api/pipeline-run-auth";
import { STAFF_ACTION_OPS, runStaffAction } from "@/lib/admin/staff-action.server";

const schema = z.object({
  actor_user_id: z.string().uuid(),
  op: z.enum(STAFF_ACTION_OPS),
  input: z.unknown(),
});

export const Route = createFileRoute("/api/public/admin/staff-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const decision = consumeRateLimit(
          "cron_invoke",
          clientIp(request),
          PUBLIC_RATE_LIMITS.cron_invoke,
        );
        if (decision.limited) return rateLimitResponse(newTraceId("cron_invoke"), decision);

        const denied = requirePipelineRunToken(request);
        if (denied) return denied;
        const read = await readJsonWithLimit(request, PUBLIC_BODY_LIMITS.staff_action);
        if (!read.ok) {
          return Response.json(
            { ok: false, error: read.error, ...read.detail },
            { status: read.status },
          );
        }
        const parsed = schema.safeParse(read.body ?? {});
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: "bad_request", detail: parsed.error.flatten() },
            { status: 400 },
          );
        }
        const out = await runStaffAction({ ...parsed.data, input: parsed.data.input ?? null });
        return Response.json(out, { status: out.ok ? 200 : out.status });
      },
    },
  },
});
