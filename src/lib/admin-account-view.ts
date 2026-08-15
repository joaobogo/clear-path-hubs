/**
 * Account-level operating view — shared types.
 *
 * Read-only aggregation. Nothing is stored for this surface, no health score,
 * no churn prediction: every figure is a raw count or a timestamp that an
 * operator can verify on its source screen.
 */

/** Position statuses that count as live delivery work (same as portfolio health). */
import { formatMoneyFromCents } from "@/lib/money";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
export const ACCOUNT_OPEN_POSITION_STATUSES = [
  "submitted",
  "under_review",
  "needs_clarification",
  "approved",
  "active",
  "paused",
] as const;

/** Match stages that are still live pipeline (everything not terminal). */
export const ACCOUNT_TERMINAL_MATCH_STAGES = [
  "hired",
  "not_moving_forward",
  "archived",
] as const;

export type AccountCommercial = {
  organization_id: string;
  plan_label: string | null;
  subscription_status: string | null;
  billing_interval: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  roles_total: number | null;
  roles_used: number | null;
  seats_limit: number;
  seats_used: number;
  seats_remaining: number;
  last_payment: {
    status: string;
    amount_cents: number;
    currency: string;
    at: string;
    position_id: string | null;
  } | null;
  generated_at: string;
};

export type AccountDelivery = {
  organization_id: string;
  open_roles: number;
  filled_roles: number;
  candidates_in_pipeline: number;
  decisions_pending: number;
  sla_breaches: number;
  generated_at: string;
};

export type AccountEngagement = {
  organization_id: string;
  last_update_sent_at: string | null;
  last_update_sent_by: string | null;
  open_support_sessions: number;
  oldest_open_support_session_at: string | null;
  generated_at: string;
};

/** @deprecated Use `formatMoneyFromCents` from `@/lib/money` directly. */
export function formatMoney(cents: number, currency: string): string {
  return formatMoneyFromCents(cents, currency);
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
