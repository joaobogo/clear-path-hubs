import { createFileRoute } from "@tanstack/react-router";

/**
 * Real preparation status for an express intake. Returns only what the
 * confirmation screen needs — never contact details, never the blueprint body.
 */
export const Route = createFileRoute("/api/public/blueprint-status/$intakeId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const intakeId = params.intakeId;
        if (!/^[0-9a-f-]{36}$/i.test(intakeId)) {
          return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const { data: intake } = await admin
          .from("intake_submissions")
          .select("id, company_name, role_title, position_id, organization_id, workspace_status, created_at")
          .eq("id", intakeId)
          .maybeSingle();
        if (!intake) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

        let blueprintStatus = "not_started";
        let blueprintError: string | null = null;
        let summary: { mustHaves: number; screeningQuestions: number; confidence: number } | null = null;

        if (intake.position_id) {
          const { data: pos } = await admin
            .from("positions")
            .select("blueprint_status, blueprint_error, blueprint")
            .eq("id", intake.position_id)
            .maybeSingle();
          if (pos) {
            blueprintStatus = pos.blueprint_status ?? "not_started";
            blueprintError = pos.blueprint_error ?? null;
            const bp = (pos.blueprint ?? {}) as Record<string, unknown>;
            if (blueprintStatus === "ready") {
              const conf = (bp.confidence ?? {}) as Record<string, unknown>;
              summary = {
                mustHaves: Array.isArray(bp.must_have_skills) ? bp.must_have_skills.length : 0,
                screeningQuestions: Array.isArray(bp.screening_questions) ? bp.screening_questions.length : 0,
                confidence: Number(conf.overall) || 0,
              };
            }
          }
        }

        return Response.json({
          ok: true,
          intakeId: intake.id,
          companyName: intake.company_name,
          roleTitle: intake.role_title,
          positionId: intake.position_id,
          workspaceStatus: intake.workspace_status,
          blueprintStatus,
          // Reasons are operational detail — surface only that it failed.
          blueprintFailed: blueprintStatus === "failed",
          blueprintErrorCode: blueprintError ? blueprintError.split(":")[0] : null,
          summary,
          createdAt: intake.created_at,
        });
      },
    },
  },
});
