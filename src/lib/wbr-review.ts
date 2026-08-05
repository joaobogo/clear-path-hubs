/**
 * Client-safe types and CSV serialization for the weekly operating review.
 * Kept out of `wbr-review.server.ts` so the route can import it.
 */

export type ReviewRowKind = "position" | "candidate" | "intake";

export type ReviewRecord = {
  id: string;
  kind: ReviewRowKind;
  label: string;
  sublabel: string | null;
  at: string | null;
};

export type ReviewMetric = {
  key: string;
  label: string;
  /** What the number literally counts — no interpretation. */
  basis: string;
  current: number;
  previous: number;
  records: ReviewRecord[];
  /** True when `records` was capped (drill-through shows the first N). */
  truncated: boolean;
};

export type RegressedRole = {
  position_id: string;
  title: string;
  client_name: string | null;
  delivered_this_week: number;
  delivered_prev_week: number;
  decisions_this_week: number;
  decisions_prev_week: number;
};

export type WeeklyReview = {
  week_start: string;
  week_end: string;
  prev_week_start: string;
  is_closed: boolean;
  include_test: boolean;
  metrics: ReviewMetric[];
  regressed_roles: RegressedRole[];
  total_activity: number;
};

export function reviewToCsv(review: WeeklyReview): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(esc("Week (UTC)") + "," + esc(review.week_start.slice(0, 10)));
  lines.push("");
  lines.push(["Metric", "This week", "Previous week", "Change", "Basis"].map(esc).join(","));
  for (const m of review.metrics) {
    lines.push(
      [m.label, m.current, m.previous, m.current - m.previous, m.basis].map(esc).join(","),
    );
  }
  lines.push("");
  lines.push(
    ["Regressed role", "Client", "Delivered this week", "Delivered previous week"]
      .map(esc)
      .join(","),
  );
  for (const r of review.regressed_roles) {
    lines.push(
      [r.title, r.client_name, r.delivered_this_week, r.delivered_prev_week].map(esc).join(","),
    );
  }
  lines.push("");
  lines.push(["Metric", "Record", "Detail", "Timestamp"].map(esc).join(","));
  for (const m of review.metrics) {
    for (const rec of m.records) {
      lines.push([m.label, rec.label, rec.sublabel, rec.at].map(esc).join(","));
    }
  }
  return lines.join("\n");
}
