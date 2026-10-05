import { createFileRoute } from "@tanstack/react-router";
import {
  PUBLIC_RATE_LIMITS,
  PUBLIC_BODY_LIMITS,
  clientIp,
  consumeRateLimit,
  harnessBypassesRateLimit,
  newTraceId,
  rateLimitResponse,
  withRateLimitHeaders,
} from "@/lib/public-api/rate-limit";
import { readJsonWithLimit } from "@/lib/public-api/body-limit";
import { expressIntakeSchema } from "@/lib/express-intake-schema";

/**
 * First conversion point for a new employer.
 *
 * The role brief is accepted before account creation. The validated payload is
 * held temporarily in a service-role-only table, then released only after the
 * same work email is authenticated on the confirmation screen.
 */
export const Route = createFileRoute("/api/public/pending-intake")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const traceId = newTraceId("pending_intake");
        const decision = harnessBypassesRateLimit(request)
          ? null
          : consumeRateLimit(
              "express_intake",
              clientIp(request),
              PUBLIC_RATE_LIMITS.express_intake,
            );
        if (decision?.limited) return rateLimitResponse(traceId, decision);

        const response = await (async (): Promise<Response> => {
          const read = await readJsonWithLimit(request, PUBLIC_BODY_LIMITS.express_intake);
          if (!read.ok) {
            return Response.json(
              { ok: false, trace_id: traceId, error: read.error, ...read.detail },
              { status: read.status },
            );
          }

          const parsed = expressIntakeSchema.safeParse(read.body);
          if (!parsed.success) {
            return Response.json(
              {
                ok: false,
                trace_id: traceId,
                error: "validation_failed",
                issues: parsed.error.flatten(),
              },
              { status: 400 },
            );
          }

          const data = parsed.data;
          if ((data.companyFax ?? "").trim() !== "") {
            return Response.json({ ok: true, trace_id: traceId, pendingId: null, skipped: true });
          }

          // Account credentials never belong in the pending brief.
          const payload = {
            ...data,
            password: "",
            confirmPassword: "",
          };

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const admin = supabaseAdmin as any;

          const { data: existing, error: existingErr } = await admin
            .from("pending_intake_submissions")
            .select("id,status,finalized_intake_id")
            .eq("idempotency_key", data.idempotencyKey)
            .maybeSingle();
          if (existingErr) {
            return Response.json(
              { ok: false, trace_id: traceId, error: "pending_lookup_failed" },
              { status: 500 },
            );
          }
          if (existing) {
            return Response.json({
              ok: true,
              trace_id: traceId,
              replay: true,
              pendingId: existing.id,
              status: existing.status,
              finalizedIntakeId: existing.finalized_intake_id,
            });
          }

          const { data: row, error } = await admin
            .from("pending_intake_submissions")
            .insert({
              idempotency_key: data.idempotencyKey,
              email: data.workEmail.trim().toLowerCase(),
              company_name: data.companyName.trim(),
              role_title: data.roleTitle.trim(),
              payload,
              status: "pending_account",
            })
            .select("id")
            .single();

          if (error || !row) {
            return Response.json(
              {
                ok: false,
                trace_id: traceId,
                error: "pending_create_failed",
                message: error?.message ?? "Could not save the role brief.",
              },
              { status: 500 },
            );
          }

          return Response.json({
            ok: true,
            trace_id: traceId,
            pendingId: row.id,
            accountRequired: true,
          });
        })();

        return withRateLimitHeaders(response, decision, traceId);
      },
    },
  },
});
