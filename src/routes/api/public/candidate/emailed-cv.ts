// Internal: enter a CV the team received by email as an application.
// Auth: the server-only PIPELINE_RUN_TOKEN (x-pipeline-run-token) or the
// scheduler's CRON_INVOKE_SECRET (x-cron-secret), as for the pipeline runner.
// The URL is public only so internal callers can reach it.
//
// Body: { position_id, actor_user_id, full_name, email, phone?, city?,
//         region?, country?, linkedin_url?, received_at?,
//         hold_screening_invite?, cv: { filename, mime, base64 } }
// The pipeline parses and scores the CV as for any applicant; nothing here
// approves, publishes or answers a screening question.

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

const schema = z.object({
  position_id: z.string().uuid(),
  actor_user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(60).nullish(),
  city: z.string().trim().max(120).nullish(),
  region: z.string().trim().max(120).nullish(),
  country: z.string().trim().max(120).nullish(),
  linkedin_url: z.string().trim().url().max(500).nullish(),
  received_at: z.string().datetime().nullish(),
  hold_screening_invite: z.boolean().nullish(),
  cv: z.object({
    filename: z.string().min(1).max(200),
    mime: z.string().min(1).max(120),
    base64: z.string().min(100),
  }),
});

export const Route = createFileRoute("/api/public/candidate/emailed-cv")({
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
        const read = await readJsonWithLimit(request, PUBLIC_BODY_LIMITS.emailed_cv);
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
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { enterEmailedCv } = await import("@/lib/candidate/emailed-cv-intake.server");
        try {
          const out = await enterEmailedCv(supabaseAdmin, parsed.data);
          if (out.ok) {
            // Parse and score now, as the apply form does; the drain is the fallback.
            const { runPipelineForMatch } = await import("@/lib/pipeline-runner.server");
            void runPipelineForMatch(out.match_id).catch((e) =>
              console.error("[emailed-cv] pipeline error", out.match_id, e),
            );
          }
          return Response.json(out, { status: out.ok ? 200 : 409 });
        } catch (e) {
          console.error("[emailed-cv] failed", e);
          return Response.json(
            { ok: false, error: "failed", message: (e as Error)?.message ?? "unknown" },
            { status: 500 },
          );
        }
      },
    },
  },
});
