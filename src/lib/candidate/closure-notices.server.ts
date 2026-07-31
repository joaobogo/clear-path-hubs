/**
 * Closing the loop on declined applications.
 *
 * A candidate who is not moving forward gets a written notice rather than
 * silence. The send is deliberately delayed past the client undo window so a
 * reversed decision never produces a rejection email, and `closure_notified_at`
 * guarantees the notice is only ever sent once per application.
 */

/** How long a decline must have stood before the candidate is told. */
export const CLOSURE_GRACE_MS = 60 * 60 * 1000; // 1 hour

export interface ClosureNoticeResult {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
}

export async function runClosureNotices(limit = 100): Promise<ClosureNoticeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail } = await import("../email-templates/send-email");

  const cutoff = new Date(Date.now() - CLOSURE_GRACE_MS).toISOString();

  const { data: matches, error } = await supabaseAdmin
    .from("candidate_matches")
    .select(
      "id,application_id,stage,updated_at,positions(title,organizations(name)),applications!inner(id,consent,closure_notified_at,withdrawn_at),candidate_profiles(full_name,email)",
    )
    .eq("stage", "not_moving_forward")
    .lt("updated_at", cutoff)
    .limit(limit);

  const result: ClosureNoticeResult = { considered: 0, sent: 0, skipped: 0, failed: 0 };
  if (error || !matches) {
    if (error) console.error("[closure-notices] query failed", error.message);
    return result;
  }

  for (const m of matches) {
    result.considered += 1;
    const app = m.applications as unknown as {
      id: string;
      consent: Record<string, unknown> | null;
      closure_notified_at: string | null;
      withdrawn_at: string | null;
    } | null;
    const cp = m.candidate_profiles as unknown as {
      full_name?: string | null;
      email?: string | null;
    } | null;
    const pos = m.positions as unknown as {
      title?: string | null;
      organizations?: { name?: string | null } | null;
    } | null;

    // Already told, withdrew themselves, or we have nowhere to write to.
    if (!app || app.closure_notified_at || app.withdrawn_at || !cp?.email) {
      result.skipped += 1;
      continue;
    }

    const reference = String(app.id).replace(/-/g, "").slice(0, 6).toUpperCase();
    try {
      const outcome = await sendTemplateEmail("application-closed", cp.email, {
        idempotencyKey: `application-closed-${app.id}`,
        templateData: {
          candidateFirstName: (cp.full_name ?? "").trim().split(" ")[0] || null,
          positionTitle: pos?.title ?? null,
          organizationName: pos?.organizations?.name ?? null,
          reference,
          jobsUrl: "https://taasflow.com/jobs",
          inTalentNetwork: Boolean(
            (app.consent as { network_opt_in?: boolean } | null)?.network_opt_in,
          ),
        },
      });

      // Mark on both a real send and a suppressed recipient: in either case
      // there is nothing further for us to deliver, and retrying would only
      // risk a duplicate notice later.
      await supabaseAdmin
        .from("applications")
        .update({ closure_notified_at: new Date().toISOString() })
        .eq("id", app.id)
        .is("closure_notified_at", null);

      if (outcome?.sent) result.sent += 1;
      else result.skipped += 1;
    } catch (err) {
      result.failed += 1;
      console.error("[closure-notices] send failed", app.id, (err as Error)?.message);
    }
  }

  return result;
}
