/**
 * Public inquiry submission — used by the marketing site's "Book a call"
 * and "Send us a message" surfaces. No auth required. Persists to
 * public.marketing_inquiries; anon reads are blocked by RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InquiryInput = z.object({
  kind: z.enum(["call", "message"]),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  role_title: z.string().trim().max(200).optional().or(z.literal("")),
  role_count: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  industry_slug: z.string().trim().max(80).optional().or(z.literal("")),
  preferred_slot: z.string().datetime().optional().or(z.literal("")),
  source_path: z.string().trim().max(300).optional().or(z.literal("")),
  // Honeypot — must be empty.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type InquiryInputT = z.infer<typeof InquiryInput>;

const empty = (v: string | undefined) => (v && v.length > 0 ? v : null);

export const submitInquiry = createServerFn({ method: "POST" })
  .inputValidator((raw) => InquiryInput.parse(raw))
  .handler(async ({ data }) => {
    // Honeypot triggered — silently succeed to avoid tipping off bots.
    if (data.website && data.website.length > 0) {
      return { ok: true, id: null as string | null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = {
      kind: data.kind,
      name: data.name,
      email: data.email,
      company: empty(data.company),
      role_title: empty(data.role_title),
      role_count: empty(data.role_count),
      message: empty(data.message),
      industry_slug: empty(data.industry_slug),
      preferred_slot: empty(data.preferred_slot),
      source_path: empty(data.source_path),
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("marketing_inquiries")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      // Never leak DB detail to the client.
      throw new Error("Could not submit inquiry. Please try again in a moment.");
    }

    // Teams channel ping (non-critical).
    try {
      const { notifyTeamsSafe } = await import("./teams-notify.server");
      notifyTeamsSafe({
        title: data.kind === "call" ? "New call request" : "New website message",
        subtitle: `${data.name}${data.company ? ` · ${data.company}` : ""}`,
        facts: [
          { label: "Email", value: data.email },
          { label: "Role", value: data.role_title },
          { label: "Roles to hire", value: data.role_count },
          { label: "Industry", value: data.industry_slug },
          { label: "Preferred slot", value: data.preferred_slot },
          { label: "Message", value: data.message },
          { label: "Source", value: data.source_path },
        ],
        linkPath: "/admin/inbox",
        linkLabel: "Open inbox",
      });
    } catch {
      // ignore
    }

    return { ok: true, id: inserted?.id ?? null };

  });
