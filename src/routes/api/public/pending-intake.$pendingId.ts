import { createFileRoute } from "@tanstack/react-router";
import { newTraceId } from "@/lib/public-api/rate-limit";

function bearer(request: Request): string | null {
  return /^bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;
}

export const Route = createFileRoute("/api/public/pending-intake/$pendingId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const traceId = newTraceId("pending_intake_read");
        if (!/^[0-9a-f-]{36}$/i.test(params.pendingId)) {
          return Response.json({ ok: false, trace_id: traceId, error: "invalid_id" }, { status: 400 });
        }

        const token = bearer(request);
        if (!token) {
          return Response.json({ ok: false, trace_id: traceId, error: "authentication_required" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;
        const { data: auth } = await admin.auth.getUser(token);
        const user = auth?.user;
        const email = (user?.email ?? "").trim().toLowerCase();
        if (!user?.id || !email) {
          return Response.json({ ok: false, trace_id: traceId, error: "invalid_session" }, { status: 401 });
        }

        const { data: row } = await admin
          .from("pending_intake_submissions")
          .select("id,email,payload,status,finalized_intake_id,expires_at")
          .eq("id", params.pendingId)
          .maybeSingle();
        if (!row) {
          return Response.json({ ok: false, trace_id: traceId, error: "not_found" }, { status: 404 });
        }
        if (String(row.email ?? "").trim().toLowerCase() !== email) {
          return Response.json(
            {
              ok: false,
              trace_id: traceId,
              error: "email_mismatch",
              message: "Sign in with the same work email you used for the role brief.",
            },
            { status: 403 },
          );
        }
        if (new Date(row.expires_at).getTime() < Date.now()) {
          await admin
            .from("pending_intake_submissions")
            .update({ status: "expired", payload: {} })
            .eq("id", row.id);
          return Response.json({ ok: false, trace_id: traceId, error: "expired" }, { status: 410 });
        }

        if (row.status === "finalized" && row.finalized_intake_id) {
          return Response.json({
            ok: true,
            trace_id: traceId,
            status: "finalized",
            finalizedIntakeId: row.finalized_intake_id,
          });
        }

        return Response.json({
          ok: true,
          trace_id: traceId,
          status: row.status,
          payload: row.payload,
        });
      },

      POST: async ({ params, request }) => {
        const traceId = newTraceId("pending_intake_finalize_mark");
        if (!/^[0-9a-f-]{36}$/i.test(params.pendingId)) {
          return Response.json({ ok: false, trace_id: traceId, error: "invalid_id" }, { status: 400 });
        }
        const token = bearer(request);
        if (!token) {
          return Response.json({ ok: false, trace_id: traceId, error: "authentication_required" }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as
          | { action?: string; intakeId?: string }
          | null;
        if (body?.action !== "finalized" || !body.intakeId || !/^[0-9a-f-]{36}$/i.test(body.intakeId)) {
          return Response.json({ ok: false, trace_id: traceId, error: "invalid_request" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;
        const { data: auth } = await admin.auth.getUser(token);
        const user = auth?.user;
        const email = (user?.email ?? "").trim().toLowerCase();
        if (!user?.id || !email) {
          return Response.json({ ok: false, trace_id: traceId, error: "invalid_session" }, { status: 401 });
        }

        const { data: row } = await admin
          .from("pending_intake_submissions")
          .select("id,email")
          .eq("id", params.pendingId)
          .maybeSingle();
        if (!row) {
          return Response.json({ ok: false, trace_id: traceId, error: "not_found" }, { status: 404 });
        }
        if (String(row.email ?? "").trim().toLowerCase() !== email) {
          return Response.json({ ok: false, trace_id: traceId, error: "email_mismatch" }, { status: 403 });
        }

        await admin
          .from("pending_intake_submissions")
          .update({
            status: "finalized",
            finalized_intake_id: body.intakeId,
            finalized_at: new Date().toISOString(),
            payload: {},
          })
          .eq("id", params.pendingId);

        return Response.json({ ok: true, trace_id: traceId });
      },
    },
  },
});
