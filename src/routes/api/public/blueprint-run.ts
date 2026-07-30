import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return Response.json({ ok: false, error: "invalid_request" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = supabaseAdmin as any;

        const { data: intake } = await admin
          .from("intake_submissions")
          .select("id, organization_id, position_id, primary_email, company_name, role_title, payload")
          .eq("id", parsed.data.intakeId)
          .maybeSingle();
        if (!intake || !intake.position_id || !intake.organization_id) {
          return Response.json({ ok: false, error: "not_found" }, { status: 404 });
        }

        const { data: position } = await admin
          .from("positions")
          .select("id, title, blueprint_status, blueprint_attempts, jd_file_path, jd_file_name, description")
          .eq("id", intake.position_id)
          .maybeSingle();
        if (!position) return Response.json({ ok: false, error: "position_missing" }, { status: 404 });

        if (!["queued", "failed", "not_started"].includes(position.blueprint_status)) {
          return Response.json({ ok: true, alreadyRunning: true, status: position.blueprint_status });
        }

        // Hard cap so a known intake id cannot be replayed to burn AI usage.
        const attempts = Number(position.blueprint_attempts ?? 0);
        if (attempts >= 5) {
          return Response.json(
            { ok: false, error: "attempt_limit_reached", status: position.blueprint_status },
            { status: 429 },
          );
        }

        // Claim the job so a double-tap or a second tab cannot run it twice.
        const { data: claimed } = await admin
          .from("positions")
          .update({
            blueprint_status: "analyzing_jd",
            blueprint_error: null,
            blueprint_attempts: attempts + 1,
          })
          .eq("id", position.id)
          .in("blueprint_status", ["queued", "failed", "not_started"])
          .select("id");
        if (!claimed || claimed.length === 0) {
          return Response.json({ ok: true, alreadyRunning: true });
        }


        const payload = (intake.payload ?? {}) as Record<string, unknown>;
        const contactFirst = typeof payload.firstName === "string" ? payload.firstName : "";
        const website = typeof payload.companyWebsite === "string" ? payload.companyWebsite : "";
        const researchConsent = payload.researchConsent !== false;

        // Pull the stored job description file back out of private storage.
        let jdFile: { bytes: Uint8Array; mime: string; filename: string } | null = null;
        if (position.jd_file_path) {
          const { data: blob, error: dlErr } = await admin.storage
            .from("job-descriptions")
            .download(position.jd_file_path);
          if (!dlErr && blob) {
            const buf = new Uint8Array(await blob.arrayBuffer());
            jdFile = {
              bytes: buf,
              mime: blob.type || "application/pdf",
              filename: position.jd_file_name || "job-description.pdf",
            };
          }
        }

        const { runBlueprintPipeline } = await import("@/lib/blueprint-pipeline.server");
        const result = await runBlueprintPipeline({
          positionId: position.id,
          organizationId: intake.organization_id,
          intakeId: intake.id,
          roleTitle: position.title ?? intake.role_title,
          companyName: intake.company_name,
          companyWebsite: website,
          contactEmail: intake.primary_email,
          contactName: contactFirst,
          researchConsent,
          jdFile,
          jdPastedText: position.description ?? "",
        });

        if (!result.ok) {
          // The role still exists and is safe — tell the client a human is on it.
          try {
            const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
            const { absoluteUrl } = await import("@/lib/blueprint-pipeline.server");
            await sendTemplateEmail("blueprint-delayed", intake.primary_email, {
              idempotencyKey: `blueprint-delayed-${position.id}`,
              templateData: {
                contactName: contactFirst,
                roleTitle: position.title ?? intake.role_title,
                workspaceUrl: absoluteUrl(`/client/positions/${position.id}`),
              },
            });
          } catch (err) {
            console.error("[blueprint-run] delayed email failed", err);
          }
        }

        return Response.json({ ok: result.ok, reason: result.reason ?? null });
      },
    },
  },
});
