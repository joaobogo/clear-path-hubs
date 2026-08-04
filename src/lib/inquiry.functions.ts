/**
 * Public inquiry submission — the single lead pipeline behind every capture
 * surface on the marketing site: scoped enquiry forms, the role-cost /
 * time-to-hire estimator, sector-briefing downloads and "book a call".
 *
 * Every lead records its vertical, the page it came from and the capture
 * kind, then gets routed (owner desk, follow-up window, first message) by
 * `routeLead`. No auth required. Anon reads are blocked by RLS.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  routeLead,
  type LeadSeniority,
  type LeadUrgency,
  type LeadVolume,
} from "@/lib/marketing/lead-routing";

const InquiryInput = z.object({
  kind: z.enum(["call", "message", "enquiry", "estimate", "briefing", "exit"]),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(200).optional().or(z.literal("")),
  role_title: z.string().trim().max(200).optional().or(z.literal("")),
  role_count: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  industry_slug: z.string().trim().max(80).optional().or(z.literal("")),
  preferred_slot: z.string().datetime().optional().or(z.literal("")),
  source_path: z.string().trim().max(300).optional().or(z.literal("")),
  seniority: z.enum(["junior", "mid", "senior", "executive"]).optional(),
  volume: z.enum(["one", "two_to_five", "six_to_ten", "eleven_plus"]).optional(),
  urgency: z.enum(["immediate", "this_quarter", "exploring"]).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
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
      return { ok: true, id: null as string | null, prefillToken: null as string | null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const vertical = empty(data.industry_slug);
    const routing = routeLead({
      verticalSlug: vertical,
      seniority: (data.seniority ?? "unknown") as LeadSeniority,
      volume: (data.volume ?? "unknown") as LeadVolume,
      urgency: (data.urgency ?? "unknown") as LeadUrgency,
      kind: data.kind,
      email: data.email,
    });

    const row = {
      kind: data.kind,
      name: data.name,
      email: data.email,
      company: empty(data.company),
      role_title: empty(data.role_title),
      role_count: empty(data.role_count),
      message: empty(data.message),
      industry_slug: vertical,
      vertical_slug: vertical,
      preferred_slot: empty(data.preferred_slot),
      source_path: empty(data.source_path),
      seniority: data.seniority ?? null,
      volume: data.volume ?? null,
      urgency: data.urgency ?? null,
      details: JSON.parse(JSON.stringify(data.details ?? {})),
      lead_score: routing.score,
      priority: routing.priority,
      owner_desk: routing.ownerDesk,
      first_response_due_at: routing.firstResponseDueAt,
      suggested_first_message: routing.suggestedFirstMessage,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("marketing_inquiries")
      .insert(row)
      .select("id, prefill_token")
      .single();

    if (error) {
      // Never leak DB detail to the client.
      throw new Error("Could not submit inquiry. Please try again in a moment.");
    }

    // Unified lead notification: Teams + internal email + delivery record.
    try {
      const { processLeadEvent } = await import("./leads/lead-pipeline.server");
      await processLeadEvent({
        leadType: "marketing_inquiry",
        sourceId: inserted?.id ?? crypto.randomUUID(),
        source: data.kind ? `inquiry_${data.kind}` : "website_inquiry",
        sourcePage: data.source_path ?? null,
        fullName: data.name,
        email: data.email,
        company: data.company ?? null,
        message: data.message ?? null,
        facts: [
          { label: "Enquiry type", value: data.kind ?? "general" },
          { label: "Role", value: data.role_title },
          { label: "Roles to hire", value: data.role_count },
          { label: "Vertical", value: vertical },
          { label: "Owner desk", value: routing.ownerDesk },
          { label: "Lead score", value: routing.score },
          { label: "Reply due", value: routing.firstResponseDueAt },
          { label: "Preferred slot", value: data.preferred_slot },
        ],
        recordTable: "marketing_inquiries",
        recordId: inserted?.id ?? null,
        linkPath: "/admin/pending-leads",
        priority: routing.priority === "p1" ? "urgent" : routing.priority === "p2" ? "high" : null,
      });
    } catch (err) {
      console.error("[inquiry] lead notification failed", err);
    }

    return {
      ok: true,
      id: inserted?.id ?? null,
      prefillToken: (inserted?.prefill_token as string | null) ?? null,
    };
  });

/**
 * Continuous capture (prompt 48): anything a lead already told us is handed
 * back once, by one-time token, so the brief starts pre-filled. Only the
 * fields the lead typed themselves are returned — never routing internals.
 */
export const getLeadPrefill = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ token: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("marketing_inquiries")
      .select("name, email, company, role_title, role_count, message, vertical_slug, details, created_at")
      .eq("prefill_token", data.token)
      .maybeSingle();

    if (!row) return { found: false as const };

    // Stale tokens stop being useful after a week.
    const age = Date.now() - new Date(row.created_at as string).getTime();
    if (age > 7 * 24 * 60 * 60 * 1000) return { found: false as const };

    return {
      found: true as const,
      lead: {
        name: row.name as string,
        email: row.email as string,
        company: (row.company as string | null) ?? "",
        roleTitle: (row.role_title as string | null) ?? "",
        roleCount: (row.role_count as string | null) ?? "",
        message: (row.message as string | null) ?? "",
        verticalSlug: (row.vertical_slug as string | null) ?? "",
      },
    };
  });
