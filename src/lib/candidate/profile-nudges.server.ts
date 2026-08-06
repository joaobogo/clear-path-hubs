/**
 * Bounded profile nudges.
 * ------------------------------------------------------------------
 * A candidate who applied with gaps gets at most two reminders, ever. Then we
 * stop. The counter lives on candidate_profiles (gap_nudge_count,
 * gap_nudge_last_at) so the ceiling survives restarts and re-runs, and the
 * `reminders` notification preference is honoured before anything is sent.
 */

import { notificationAllowed } from "./notification-events";

export const MAX_PROFILE_NUDGES = 2;
/** Wait this long after applying before the first nudge. */
export const FIRST_NUDGE_DELAY_MS = 24 * 60 * 60 * 1000;
/** And this long between nudges. */
export const NUDGE_SPACING_MS = 5 * 24 * 60 * 60 * 1000;

export interface NudgeSweepResult {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
}

export interface ProfileGapInputs {
  hasCv: boolean;
  location: string | null | undefined;
  phone: string | null | undefined;
  headline: string | null | undefined;
  experience: unknown;
}

/** Plain-language list of what is missing. Empty means nothing to chase. */
export function missingProfileItems(i: ProfileGapInputs): string[] {
  const missing: string[] = [];
  if (!i.hasCv) missing.push("a CV in PDF form");
  if (!i.location?.trim()) missing.push("where you are based");
  if (!i.phone?.trim()) missing.push("a phone number, in case an employer needs to reach you");
  if (!i.headline?.trim()) missing.push("a one-line headline for your profile");
  const exp = i.experience;
  const hasExperience = Array.isArray(exp) ? exp.length > 0 : Boolean(exp);
  if (!hasExperience) missing.push("a short summary of your recent experience");
  return missing;
}

/** Whether this profile may be nudged right now. */
export function nudgeDue(i: {
  nudgeCount: number | null | undefined;
  lastNudgeAt: string | null | undefined;
  appliedAt: string;
  now?: Date;
}): boolean {
  const count = i.nudgeCount ?? 0;
  if (count >= MAX_PROFILE_NUDGES) return false;
  const now = (i.now ?? new Date()).getTime();
  if (i.lastNudgeAt) {
    return now - new Date(i.lastNudgeAt).getTime() >= NUDGE_SPACING_MS;
  }
  return now - new Date(i.appliedAt).getTime() >= FIRST_NUDGE_DELAY_MS;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export async function runProfileNudges(limit = 100): Promise<NudgeSweepResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail } = await import("../email-templates/send-email");

  const result: NudgeSweepResult = { considered: 0, sent: 0, skipped: 0, failed: 0 };
  const now = new Date();
  const cutoff = new Date(now.getTime() - FIRST_NUDGE_DELAY_MS).toISOString();

  const { data, error } = await supabaseAdmin
    .from("applications")
    .select(
      `id,status,applied_at,created_at,cv_file_id,withdrawn_at,is_test_record,
       positions(title),
       candidate_profiles(id,full_name,email,consent,location,phone,headline,experience,current_cv_file_id,gap_nudge_count,gap_nudge_last_at)`,
    )
    .in("status", ["submitted", "processing", "ready_for_review"])
    .is("withdrawn_at", null)
    .eq("is_test_record", false)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("[profile-nudges] query failed", error.message);
    return result;
  }

  const seenProfiles = new Set<string>();

  for (const app of data as Any[]) {
    result.considered += 1;
    const cp = app.candidate_profiles as Any;
    if (!cp?.email || !cp?.id || seenProfiles.has(cp.id)) {
      result.skipped += 1;
      continue;
    }
    if (!notificationAllowed(cp.consent ?? null, "reminders")) {
      result.skipped += 1;
      continue;
    }

    const missing = missingProfileItems({
      hasCv: Boolean(app.cv_file_id ?? cp.current_cv_file_id),
      location: cp.location,
      phone: cp.phone,
      headline: cp.headline,
      experience: cp.experience,
    });
    if (missing.length === 0) {
      result.skipped += 1;
      continue;
    }

    const count = Number(cp.gap_nudge_count ?? 0);
    if (
      !nudgeDue({
        nudgeCount: count,
        lastNudgeAt: cp.gap_nudge_last_at,
        appliedAt: String(app.applied_at ?? app.created_at),
        now,
      })
    ) {
      result.skipped += 1;
      continue;
    }

    seenProfiles.add(cp.id);
    const nextCount = count + 1;
    try {
      const outcome = await sendTemplateEmail("profile-incomplete", cp.email, {
        idempotencyKey: `profile-nudge-${cp.id}-${nextCount}`,
        templateData: {
          candidateFirstName: (cp.full_name ?? "").trim().split(" ")[0] || null,
          positionTitle: app.positions?.title ?? null,
          missing: missing.slice(0, 3),
          profileUrl: "https://taasflow.com/me/profile",
          finalNudge: nextCount >= MAX_PROFILE_NUDGES,
        },
      });

      // Count the attempt either way — a suppressed recipient must not be
      // retried forever, and the ceiling is about how often we chase, not how
      // often we deliver.
      await supabaseAdmin
        .from("candidate_profiles")
        .update({ gap_nudge_count: nextCount, gap_nudge_last_at: now.toISOString() })
        .eq("id", cp.id);

      if (outcome?.sent) result.sent += 1;
      else result.skipped += 1;
    } catch (err) {
      console.error("[profile-nudges] send failed", (err as Error)?.message);
      result.failed += 1;
    }
  }

  return result;
}
