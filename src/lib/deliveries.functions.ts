import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Deliveries are ISO-week rollups of client-visible candidate matches per position.
 * Derived from candidate_matches.delivered_at (falls back to updated_at when null).
 * Next delivery is computed from the canonical weekly cadence.
 */

const listInput = z.object({
  organization_id: z.string().uuid(),
  position_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(52).default(12),
});

export type DeliveryRow = {
  key: string; // iso_week + position_id
  iso_week: string; // YYYY-Www
  week_start: string; // ISO date
  week_end: string; // ISO date
  position_id: string;
  position_title: string | null;
  candidate_count: number;
  new_count: number; // delivered_at within this week
  refreshed_count: number; // client_visibility=visible, delivered_at older but updated in week
  band_high: number; // final_score >= 80
  band_mid: number; // 60-79
  band_low: number; // < 60
  match_ids: string[];
  earliest: string;
  latest: string;
};

function isoWeek(dateIso: string): { key: string; start: Date; end: Date } {
  const d = new Date(dateIso);
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  // ISO week number
  const target = new Date(monday);
  target.setUTCDate(target.getUTCDate() + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  const key = `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  return { key, start: monday, end: sunday };
}

export const listDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => listInput.parse(v))
  .handler(async ({ data, context }) => {
    // Only client-visible candidates count toward deliveries.
    let q = context.supabase
      .from("candidate_matches")
      .select(
        "id, position_id, delivered_at, updated_at, approved_score_run_id, positions(title), score_runs!candidate_matches_approved_score_run_id_fkey(final_score)",
      )
      .eq("organization_id", data.organization_id)
      .eq("client_visibility", "visible");

    if (data.position_id) q = q.eq("position_id", data.position_id);

    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);

    type Rec = {
      id: string;
      position_id: string;
      delivered_at: string | null;
      updated_at: string;
      positions?: { title: string } | null;
      score_runs?: { final_score: number | null } | null;
    };

    const buckets = new Map<string, DeliveryRow>();
    for (const raw of (rows ?? []) as unknown as Rec[]) {
      const anchor = raw.delivered_at ?? raw.updated_at;
      const { key, start, end } = isoWeek(anchor);
      const bucketKey = `${key}::${raw.position_id}`;
      const finalScore = raw.score_runs?.final_score ?? null;

      let b = buckets.get(bucketKey);
      if (!b) {
        b = {
          key: bucketKey,
          iso_week: key,
          week_start: start.toISOString(),
          week_end: end.toISOString(),
          position_id: raw.position_id,
          position_title: raw.positions?.title ?? null,
          candidate_count: 0,
          new_count: 0,
          refreshed_count: 0,
          band_high: 0,
          band_mid: 0,
          band_low: 0,
          match_ids: [],
          earliest: anchor,
          latest: anchor,
        };
        buckets.set(bucketKey, b);
      }
      b.candidate_count += 1;
      b.match_ids.push(raw.id);
      if (raw.delivered_at && new Date(raw.delivered_at) >= start && new Date(raw.delivered_at) <= end) {
        b.new_count += 1;
      } else {
        b.refreshed_count += 1;
      }
      if (finalScore != null) {
        if (finalScore >= 80) b.band_high += 1;
        else if (finalScore >= 60) b.band_mid += 1;
        else b.band_low += 1;
      }
      if (anchor < b.earliest) b.earliest = anchor;
      if (anchor > b.latest) b.latest = anchor;
    }

    const sorted = Array.from(buckets.values())
      .sort((a, b) => (a.week_start > b.week_start ? -1 : 1))
      .slice(0, data.limit);
    return { deliveries: sorted };
  });

/** Next scheduled delivery dates based on the canonical weekly cadence. */
export const getUpcomingDeliverySchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => z.object({ organization_id: z.string().uuid(), weeks: z.number().int().min(1).max(8).default(4) }).parse(v))
  .handler(async ({ data }) => {
    // Weekly on Thursday (typical shortlist refresh day)
    const now = new Date();
    const day = now.getUTCDay(); // Sun=0..Sat=6
    const daysToThursday = (4 - day + 7) % 7 || 7;
    const first = new Date(now);
    first.setUTCDate(now.getUTCDate() + daysToThursday);
    first.setUTCHours(14, 0, 0, 0);
    const schedule = Array.from({ length: data.weeks }).map((_, i) => {
      const d = new Date(first);
      d.setUTCDate(first.getUTCDate() + i * 7);
      return { scheduled_at: d.toISOString() };
    });
    return { schedule, cadence: "weekly" as const };
  });

/** Attach batch-level feedback to a delivery (stored on each match's metadata via candidate_matches — placeholder no-op for now). */
export const submitDeliveryFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) =>
    z
      .object({
        organization_id: z.string().uuid(),
        match_ids: z.array(z.string().uuid()).min(1).max(200),
        feedback: z.string().trim().min(1).max(4000),
        outcome: z.enum(["approved", "calibrate", "changes_requested"]),
      })
      .parse(v),
  )
  .handler(async ({ data, context }) => {
    // Log an audit event per match so the recruiter workflow surfaces it.
    const rows = data.match_ids.map((mid) => ({
      actor_user_id: context.userId,
      organization_id: data.organization_id,
      entity_type: "candidate_matches",
      entity_id: mid,
      action: "delivery_feedback",
      after_state: { feedback: data.feedback, outcome: data.outcome },
    }));
    const { error } = await context.supabase.from("audit_events").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });
