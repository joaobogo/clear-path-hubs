import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
/**
 * Client update readiness — shared types and pure helpers.
 *
 * Everything shown is derived from real records. The baseline is the last
 * "update sent" marker (audit_events), falling back to the last recorded
 * client-visible activity, falling back to the organization's creation date.
 */

/** audit_events action names for the baseline markers. */
export const UPDATE_SENT_ACTION = "client_update.sent";
export const UPDATE_SENT_REVERTED_ACTION = "client_update.sent_reverted";
export const UPDATE_ENTITY = "organization";

/** A marked update can be reversed for 24 hours. */
export const REVERT_WINDOW_MS = 24 * 3_600_000;

export type ReadinessLinkKind = "candidate" | "position";

export type ReadinessItem = {
  id: string;
  /** One-line, record-derived summary. */
  label: string;
  detail: string | null;
  at: string;
  link_kind: ReadinessLinkKind;
  /** Route param for the linked record. */
  link_id: string;
};

export type ReadinessSection = {
  key:
    | "submitted"
    | "decisions"
    | "interviews"
    | "stage_moves"
    | "blockers"
    | "notes";
  title: string;
  items: ReadinessItem[];
};

export type UpdateReadiness = {
  organization_id: string;
  organization_name: string;
  baseline_at: string;
  baseline_source: "update_sent" | "client_activity" | "organization_created";
  /** Set when the baseline came from a marker that can still be reversed. */
  revert_event_id: string | null;
  revert_available_until: string | null;
  sections: ReadinessSection[];
  total_items: number;
  generated_at: string;
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Plain-text summary for copy-to-clipboard. No generated prose. */
export function readinessToText(r: UpdateReadiness): string {
  const lines: string[] = [
    `${r.organization_name} — update since ${formatDate(r.baseline_at)}`,
    "",
  ];
  for (const section of r.sections) {
    if (section.items.length === 0) continue;
    lines.push(`${section.title} (${section.items.length})`);
    for (const item of section.items) {
      lines.push(
        `  - ${item.label}${item.detail ? ` — ${item.detail}` : ""} (${formatDate(item.at)})`,
      );
    }
    lines.push("");
  }
  if (r.total_items === 0) {
    lines.push(`Nothing has changed since the last update on ${formatDate(r.baseline_at)}.`);
  }
  return lines.join("\n").trimEnd();
}
