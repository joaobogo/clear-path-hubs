/**
 * Kickoff booking — the meeting a client books right after their first role.
 *
 * The browser needs two things before it can show the Calendly embed on the
 * intake confirmation screen: a booking session id (so the signed webhook can
 * match the meeting back to us and to the CRM) and the details we already hold,
 * so the visitor never retypes their name.
 *
 * Unauthenticated by design — the caller is a brand-new client who has an
 * intake id but not necessarily a session yet — so it only ever returns the
 * intake's own details, keyed by that unguessable id.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { throttlePublicFn } from "@/lib/public-api/server-fn-guard";

const schema = z.object({ intakeId: z.string().uuid() });

export type KickoffBooking = {
  sessionId: string | null;
  name: string | null;
  email: string | null;
  companyName: string | null;
  roleTitle: string | null;
  positionId: string | null;
};

export const startKickoffBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }): Promise<KickoffBooking> => {
    throttlePublicFn("booking_write");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: intake } = await supabaseAdmin
      .from("intake_submissions")
      .select("id, primary_email, company_name, role_title, position_id, payload")
      .eq("id", data.intakeId)
      .maybeSingle();

    if (!intake) return { sessionId: null, name: null, email: null, companyName: null, roleTitle: null, positionId: null };

    const payload = (intake.payload ?? {}) as Record<string, unknown>;
    const contact = (payload["contact"] ?? {}) as Record<string, unknown>;
    const pick = (...keys: string[]): string | null => {
      for (const key of keys) {
        const fromContact = contact[key];
        if (typeof fromContact === "string" && fromContact.trim()) return fromContact.trim();
        const fromRoot = payload[key];
        if (typeof fromRoot === "string" && fromRoot.trim()) return fromRoot.trim();
      }
      return null;
    };

    const first = pick("firstName", "first_name") ?? "";
    const last = pick("lastName", "last_name") ?? "";
    const fullName = pick("fullName", "full_name", "name") ?? `${first} ${last}`.trim();
    const email = intake.primary_email ?? pick("email");

    // One kickoff session per intake: reuse the row if this screen is reopened.
    const { data: existing } = await supabaseAdmin
      .from("booking_sessions")
      .select("id")
      .eq("meeting_type", "discovery")
      .contains("attribution", { intake_id: data.intakeId })
      .limit(1)
      .maybeSingle();

    let sessionId = existing?.id ?? null;

    if (!sessionId) {
      const { data: created, error } = await supabaseAdmin
        .from("booking_sessions")
        .insert({
          status: "intake_submitted",
          meeting_type: "discovery",
          first_name: first || fullName || "Client",
          last_name: last || "",
          email: email ?? "",
          company_name: intake.company_name,
          roles_hiring: intake.role_title,
          additional_context: "Kickoff call booked from the intake confirmation screen.",
          attribution: { intake_id: data.intakeId, source_page_url: "/intake/confirmation" },
        })
        .select("id")
        .single();
      if (error) {
        console.error("[kickoff] booking session insert failed", error.message);
        return {
          sessionId: null,
          name: fullName || null,
          email: email ?? null,
          companyName: intake.company_name,
          roleTitle: intake.role_title,
          positionId: intake.position_id,
        };
      }
      sessionId = created.id;
    }

    return {
      sessionId,
      name: fullName || null,
      email: email ?? null,
      companyName: intake.company_name,
      roleTitle: intake.role_title,
      positionId: intake.position_id,
    };
  });
