import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import type { DigestRoleLine } from "@/lib/email-templates/client-weekly-digest";

/**
 * Weekly client digest — one email per recipient, per organisation, per week.
 * Facts only: what moved, what is waiting on them, what happens next.
 * Recipients opt in through client_notification_preferences.digest = 'weekly'.
 */

const SITE_URL = "https://taasflow.com";

const STAGE_LABEL: Record<string, string> = {
  sourced: "Sourcing in progress",
  screened: "Screening in progress",
  delivered: "Shortlist under review",
  interviewing: "Interviews under way",
  offer: "Offer stage",
  hired: "Hired",
  rejected: "Closed",
};

type AnyRow = Record<string, any>;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export async function runWeeklyDigest(options: { dryRun?: boolean } = {}): Promise<{
  organizations: number;
  recipients: number;
  sent: number;
  skipped: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const weekAgo = isoDaysAgo(7);
  const nowIso = new Date().toISOString();
  const weekEnding = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const { data: prefs, error: prefErr } = await supabaseAdmin
    .from("client_notification_preferences")
    .select("user_id, organization_id, email_enabled, digest")
    .eq("digest", "weekly")
    .eq("email_enabled", true);
  if (prefErr) throw new Error(prefErr.message);

  const byOrg = new Map<string, string[]>();
  for (const p of (prefs ?? []) as AnyRow[]) {
    if (!p.organization_id || !p.user_id) continue;
    const list = byOrg.get(p.organization_id) ?? [];
    list.push(p.user_id);
    byOrg.set(p.organization_id, list);
  }

  let recipients = 0;
  let sent = 0;
  let skipped = 0;

  for (const [orgId, userIds] of byOrg) {
    const [orgRes, positionsRes] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, name").eq("id", orgId).maybeSingle(),
      supabaseAdmin
        .from("positions")
        .select("id, title, status")
        .eq("organization_id", orgId)
        .in("status", ["active", "approved"])
        .limit(25),
    ]);

    const positions = (positionsRes.data ?? []) as AnyRow[];
    const roles: DigestRoleLine[] = [];

    for (const p of positions) {
      const [newRes, waitingRes, interviewsRes, latestRes] = await Promise.all([
        supabaseAdmin
          .from("candidate_matches")
          .select("id", { count: "exact", head: true })
          .eq("position_id", p.id)
          .gte("created_at", weekAgo),
        supabaseAdmin
          .from("candidate_matches")
          .select("id", { count: "exact", head: true })
          .eq("position_id", p.id)
          .eq("stage", "delivered"),
        supabaseAdmin
          .from("interviews")
          .select("id", { count: "exact", head: true })
          .eq("position_id", p.id)
          .gte("scheduled_at", nowIso),
        supabaseAdmin
          .from("candidate_matches")
          .select("stage")
          .eq("position_id", p.id)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

      const awaiting = waitingRes.count ?? 0;
      const interviews = interviewsRes.count ?? 0;
      const latestStage = ((latestRes.data ?? [])[0] as AnyRow | undefined)?.stage as
        | string
        | undefined;

      roles.push({
        title: (p.title as string) ?? "Role",
        stage: STAGE_LABEL[latestStage ?? ""] ?? "Search under way",
        newCandidates: newRes.count ?? 0,
        awaitingDecision: awaiting,
        interviews,
        nextStep:
          awaiting > 0
            ? `Review ${awaiting} shortlisted candidate${awaiting === 1 ? "" : "s"}`
            : interviews > 0
              ? "Attend the booked interviews"
              : "We keep sourcing — nothing needed from you",
      });
    }

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("auth_user_id, full_name, email")
      .in("auth_user_id", userIds);

    for (const prof of (profiles ?? []) as AnyRow[]) {
      if (!prof.email) {
        skipped += 1;
        continue;
      }
      recipients += 1;
      if (options.dryRun) continue;
      try {
        const result = await sendTemplateEmail("client-weekly-digest", prof.email as string, {
          templateData: {
            contactName: (prof.full_name as string | null) ?? undefined,
            companyName: (orgRes.data as AnyRow | null)?.name ?? undefined,
            weekEnding,
            roles,
            dashboardUrl: `${SITE_URL}/client`,
          },
          idempotencyKey: `weekly-digest-${orgId}-${prof.auth_user_id}-${weekAgo.slice(0, 10)}`,
        });
        if (result.sent) sent += 1;
        else skipped += 1;
      } catch (err) {
        console.error("[weekly-digest] send failed", (err as Error)?.message);
        skipped += 1;
      }
    }
  }

  return { organizations: byOrg.size, recipients, sent, skipped };
}
