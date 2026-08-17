import { createFileRoute } from "@tanstack/react-router";
import {
  PUBLIC_RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  newTraceId,
  rateLimitResponse,
} from "@/lib/public-api/rate-limit";
import { formatEnumLabel } from "@/lib/human-labels";

export const Route = createFileRoute("/api/public/intake-status/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const traceId = newTraceId("public_status_read");
        const decision = consumeRateLimit(
          "public_status_read",
          clientIp(request),
          PUBLIC_RATE_LIMITS.public_status_read,
        );
        if (decision.limited) return rateLimitResponse(traceId, decision);

        const id = params.id;
        if (!id || !/^[0-9a-f-]{8,}$/i.test(id)) {
          return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Unauthenticated caller: read only the fields the confirmation screen
        // renders. No organization_id, no company name, no other tenant data.
        const { data, error } = await supabaseAdmin
          .from("intake_submissions")
          .select("id, status")
          .eq("id", id)
          .maybeSingle();
        if (error) {
          return Response.json({ ok: false, error: "lookup_failed" }, { status: 500 });
        }
        if (!data) {
          return Response.json({ ok: false, error: "not_found" }, { status: 404 });
        }
        return Response.json({
          ok: true,
          intake: {
            id: data.id,
            status: data.status,
            statusLabel: formatEnumLabel(data.status, "Received"),
          },
        });
      },
    },
  },
});
