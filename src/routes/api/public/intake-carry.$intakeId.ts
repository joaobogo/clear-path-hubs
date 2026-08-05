import { createFileRoute } from "@tanstack/react-router";
import { buildCarryForward } from "@/lib/intake-carry";

/**
 * Company profile defaults for a second (or third) role, looked up by the
 * submission reference the client already holds.
 *
 * Public by necessity — the confirmation screen runs before the browser may
 * have a session — so it returns company and role-practicality defaults ONLY.
 * No contact name, email or phone: those come from the authenticated path.
 */
export const Route = createFileRoute("/api/public/intake-carry/$intakeId")({
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
          .select("id, organization_id, position_id")
          .eq("id", intakeId)
          .maybeSingle();
        if (!intake) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

        const { data: org } = intake.organization_id
          ? await admin
              .from("organizations")
              .select("name, website, phone")
              .eq("id", intake.organization_id)
              .maybeSingle()
          : { data: null };

        // The role this client just submitted is the best statement of how they
        // hire; it is read, never modified.
        const { data: position } = intake.position_id
          ? await admin
              .from("positions")
              .select("location, work_model, work_authorization, compensation, intake_context")
              .eq("id", intake.position_id)
              .maybeSingle()
          : { data: null };

        const carry = buildCarryForward({ organization: org, position, contact: null });
        return Response.json({ ok: true, ...carry });
      },
    },
  },
});
