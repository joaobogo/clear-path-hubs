import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Staff-only view of managed email delivery events: bounces, complaints,
 * unsubscribes, suppressed sends and rate-limited sends, plus accepted sends.
 * Read-only — delivery state lives with the mail platform, not in our database.
 */
export const listEmailDeliveryEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        eventType: z.string().max(40).optional(),
        recipient: z.string().max(320).optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { data: staff } = await context.supabase.rpc("is_platform_staff", {
      _user: context.userId,
    });
    if (staff !== true) throw new Error("Forbidden");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        available: false as const,
        reason: "Email delivery history is not available in this environment.",
        items: [],
        counts: {} as Record<string, number>,
        historyStartsAt: null as string | null,
      };
    }

    const { listEmailLogs } = await import("@lovable.dev/email-js");
    let result;
    try {
      result = await listEmailLogs(
        {
          limit: 100,
          ...(data.eventType ? { event_type: data.eventType } : {}),
          ...(data.recipient ? { recipient: data.recipient } : {}),
        },
        { apiKey },
      );
    } catch (err) {
      return {
        available: false as const,
        reason:
          err instanceof Error
            ? err.message
            : "Could not reach the email delivery service.",
        items: [],
        counts: {} as Record<string, number>,
        historyStartsAt: null as string | null,
      };
    }

    const events = result.data ?? [];

    // Attach the person and role behind each address where we can, so a failure
    // is actionable rather than an anonymous email address.
    const recipients = Array.from(new Set(events.map((e) => e.recipient))).slice(0, 200);
    const identities = new Map<string, { name: string | null; role: string }>();
    if (recipients.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: profiles }, { data: candidates }] = await Promise.all([
        supabaseAdmin.from("profiles").select("email, full_name").in("email", recipients),
        supabaseAdmin.from("candidate_profiles").select("email, full_name").in("email", recipients),
      ]);
      for (const c of candidates ?? []) {
        if (c.email) identities.set(c.email, { name: c.full_name ?? null, role: "Candidate" });
      }
      for (const p of profiles ?? []) {
        if (p.email) identities.set(p.email, { name: p.full_name ?? null, role: "Account user" });
      }
    }

    const counts: Record<string, number> = {};
    for (const e of events) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;

    return {
      available: true as const,
      reason: null,
      historyStartsAt: result.history_starts_at ?? null,
      counts,
      items: events.map((e) => ({
        timestamp: e.timestamp,
        recipient: e.recipient,
        eventType: e.event_type,
        status: e.status ?? null,
        messageId: e.message_id ?? null,
        who: identities.get(e.recipient)?.name ?? null,
        role: identities.get(e.recipient)?.role ?? "Unknown recipient",
      })),
    };
  });
