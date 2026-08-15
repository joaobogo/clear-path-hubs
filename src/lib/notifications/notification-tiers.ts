/**
 * TaaSFlow notification tiers.
 *
 * Browser-safe: pure data and pure functions only.
 *
 * One persisted event produces at most one notification per recipient
 * (enforced in `emitEventFromServer` by the idempotency key and the
 * (event_id, recipient) upsert). This module adds the *reading* layer on top:
 * how urgent an item is, what it affects, why it matters, whether it needs an
 * action, and how it may be dismissed.
 *
 * Language rules carried over from the event catalogue: no candidate names,
 * no raw scores, and no internal processing states in client or candidate
 * copy. The tier metadata below is written so it is safe to render in any
 * channel — including ones where we cannot be certain who is reading.
 */

import type { Audience, EventType } from "@/lib/events";

export const NOTIFICATION_TIERS = [
  "critical",
  "action_required",
  "important",
  "informational",
] as const;

export type NotificationTier = (typeof NOTIFICATION_TIERS)[number];

export type DismissalBehaviour =
  /** Stays until the underlying problem is resolved; cannot be swiped away. */
  | "sticky"
  /** Clears when the user completes the action it asks for. */
  | "on_action"
  /** User may clear it whenever they like. */
  | "manual";

export type TierMeta = {
  label: string;
  /** One line explaining what this tier means, shown in the inbox header. */
  description: string;
  /** Token-based classes — never hardcoded colours. */
  badgeClass: string;
  accentClass: string;
  order: number;
};

export const TIER_META: Record<NotificationTier, TierMeta> = {
  critical: {
    label: "Critical",
    description: "Something is broken or at risk. Handle these first.",
    badgeClass: "bg-destructive text-destructive-foreground",
    accentClass: "border-l-destructive",
    order: 0,
  },
  action_required: {
    label: "Action required",
    description: "Work is waiting on a person before it can continue.",
    badgeClass: "bg-primary text-primary-foreground",
    accentClass: "border-l-primary",
    order: 1,
  },
  important: {
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";
    label: "Important update",
    description: "Something changed that affects a decision you own.",
    badgeClass: "bg-secondary text-secondary-foreground",
    accentClass: "border-l-secondary",
    order: 2,
  },
  informational: {
    label: "Informational",
    description: "A record of routine system work. Nothing is expected of you.",
    badgeClass: "bg-muted text-muted-foreground",
    accentClass: "border-l-muted",
    order: 3,
  },
};

export type NotificationRule = {
  tier: NotificationTier;
  /** What this notification affects, in the reader's own terms. */
  affects: string;
  /** Why it matters — the consequence of ignoring it. */
  why: string;
  /** The single action, when one is genuinely required. */
  action?: string;
  dismissal: DismissalBehaviour;
  /**
   * Items sharing a group label and the same subject are collapsed into one
   * row with a count, so a burst of related activity reads as one thing.
   */
  group: string;
  /**
   * True when the copy for this event can reference a specific candidate.
   * These are withheld from any channel where the reader's permissions are
   * not certain (see `isSafeForUncertainAudience`).
   */
  candidateSensitive?: boolean;
};

const RULES: Partial<Record<EventType, NotificationRule>> = {
  // ── Critical ───────────────────────────────────────────────────────────
  payment_failed: {
    tier: "critical",
    affects: "Your subscription and any role waiting to go live",
    why: "Roles cannot be published while a payment is outstanding.",
    action: "Update payment details",
    dismissal: "sticky",
    group: "Billing",
  },
  integration_failed: {
    tier: "critical",
    affects: "A connection this workspace depends on",
    why: "While it is down, updates from that system stop arriving.",
    action: "Open integration health",
    dismissal: "sticky",
    group: "Connections",
  },
  security_alert: {
    tier: "critical",
    affects: "Access to this workspace",
    why: "Unrecognised access should be reviewed straight away.",
    action: "Review account access",
    dismissal: "sticky",
    group: "Security",
  },

  // ── Action required ────────────────────────────────────────────────────
  approval_needed: {
    tier: "action_required",
    affects: "A role in your pipeline",
    why: "Nothing moves forward until someone approves it.",
    action: "Review and decide",
    dismissal: "on_action",
    group: "Approvals",
  },
  role_information_missing: {
    tier: "action_required",
    affects: "One of your roles",
    why: "Sourcing stays paused while required details are missing.",
    action: "Complete the role",
    dismissal: "on_action",
    group: "Role setup",
  },
  agent_run_blocked: {
    tier: "action_required",
    affects: "Automated work on a role",
    why: "The run stopped and will not restart on its own.",
    action: "Review the blocker",
    dismissal: "on_action",
    group: "Agent runs",
  },
  clarification_requested: {
    tier: "action_required",
    affects: "A role you submitted",
    why: "We cannot finish setup until the question is answered.",
    action: "Answer the question",
    dismissal: "on_action",
    group: "Role setup",
  },
  candidate_ready_for_admin_review: {
    tier: "action_required",
    affects: "A candidate waiting on review",
    why: "The candidate is not visible to the client until reviewed.",
    action: "Open review",
    dismissal: "on_action",
    group: "Review queue",
    candidateSensitive: true,
  },
  screening_needs_review: {
    tier: "action_required",
    affects: "An application review that needs a person",
    why: "Automated checks were not conclusive.",
    action: "Make the call",
    dismissal: "on_action",
    group: "Review queue",
    candidateSensitive: true,
  },
  cv_parse_failed: {
    tier: "action_required",
    affects: "One application document",
    why: "Without a readable document the application cannot progress.",
    action: "Retry or request a new file",
    dismissal: "on_action",
    group: "Documents",
    candidateSensitive: true,
  },
  contact_release_requested: {
    tier: "action_required",
    affects: "Candidate contact details",
    why: "Contact details stay withheld until released deliberately.",
    action: "Review the request",
    dismissal: "on_action",
    group: "Approvals",
    candidateSensitive: true,
  },
  client_information_requested: {
    tier: "action_required",
    affects: "A candidate decision",
    why: "The client is waiting before they can decide.",
    action: "Respond",
    dismissal: "on_action",
    group: "Messages",
    candidateSensitive: true,
  },
  interview_requested: {
    tier: "action_required",
    affects: "An interview that still needs a time",
    why: "Good candidates lose interest while scheduling drags.",
    action: "Propose times",
    dismissal: "on_action",
    group: "Interviews",
    candidateSensitive: true,
  },
  interview_rescheduled: {
    tier: "action_required",
    affects: "A booked interview",
    why: "A new time has to be confirmed before the slot passes.",
    action: "Confirm a new time",
    dismissal: "on_action",
    group: "Interviews",
    candidateSensitive: true,
  },
  intake_submitted: {
    tier: "action_required",
    affects: "A new client role",
    why: "The client is waiting for their role to be picked up.",
    action: "Open intake",
    dismissal: "on_action",
    group: "Intake",
  },
  member_invited: {
    tier: "informational",
    affects: "Your team list",
    why: "Keeps everyone clear on who has access.",
    dismissal: "manual",
    group: "Team",
  },

  // ── Important update ───────────────────────────────────────────────────
  shortlist_ready: {
    tier: "important",
    affects: "A role you are hiring for",
    why: "The shortlist is ready to compare side by side.",
    action: "Review the shortlist",
    dismissal: "on_action",
    group: "Shortlists",
    candidateSensitive: true,
  },
  candidate_published: {
    tier: "important",
    affects: "Your candidate pipeline",
    why: "A new candidate is ready for your decision.",
    action: "Open the candidate",
    dismissal: "on_action",
    group: "Candidates",
    candidateSensitive: true,
  },
  scoring_completed: {
    tier: "important",
    affects: "Evidence behind a candidate",
    why: "Findings changed, so the ranking you saw earlier may differ.",
    dismissal: "manual",
    group: "Evidence",
    candidateSensitive: true,
  },
  client_shortlisted: {
    tier: "important",
    affects: "A candidate in this role",
    why: "The next step is scheduling.",
    dismissal: "manual",
    group: "Decisions",
    candidateSensitive: true,
  },
  client_feedback_submitted: {
    tier: "important",
    affects: "A candidate decision",
    why: "Feedback shapes what we send you next.",
    dismissal: "manual",
    group: "Decisions",
    candidateSensitive: true,
  },
  client_hold: {
    tier: "important",
    affects: "A candidate in this role",
    why: "Held candidates stop progressing until released.",
    dismissal: "manual",
    group: "Decisions",
    candidateSensitive: true,
  },
  client_declined: {
    tier: "important",
    affects: "A candidate in this role",
    why: "We adjust sourcing based on what you turn down.",
    dismissal: "manual",
    group: "Decisions",
    candidateSensitive: true,
  },
  message_sent: {
    tier: "important",
    affects: "A conversation on this role",
    why: "Replies are expected within your service commitment.",
    action: "Open the conversation",
    dismissal: "on_action",
    group: "Messages",
  },
  interview_scheduled: {
    tier: "important",
    affects: "Your calendar",
    why: "The time is now confirmed with everyone.",
    dismissal: "manual",
    group: "Interviews",
    candidateSensitive: true,
  },
  interview_completed: {
    tier: "important",
    affects: "A candidate decision",
    why: "A decision is expected while the interview is fresh.",
    action: "Add your feedback",
    dismissal: "on_action",
    group: "Interviews",
    candidateSensitive: true,
  },
  interview_cancelled: {
    tier: "important",
    affects: "Your calendar",
    why: "The slot is free again and may need rebooking.",
    dismissal: "manual",
    group: "Interviews",
    candidateSensitive: true,
  },
  candidate_hired: {
    tier: "important",
    affects: "This role's outcome",
    why: "The role can be closed once the start date is agreed.",
    dismissal: "manual",
    group: "Outcomes",
    candidateSensitive: true,
  },
  contact_released: {
    tier: "important",
    affects: "How you reach this candidate",
    why: "You can now contact them directly.",
    dismissal: "manual",
    group: "Candidates",
    candidateSensitive: true,
  },
  contact_revoked: {
    tier: "informational",
    affects: "How you reach this candidate",
    why: "Direct contact is no longer available for this candidate.",
    dismissal: "manual",
    group: "Candidates",
    candidateSensitive: true,
  },
  position_approved: {
    tier: "important",
    affects: "A role you submitted",
    why: "It is cleared and being prepared for launch.",
    dismissal: "manual",
    group: "Roles",
  },
  position_activated: {
    tier: "important",
    affects: "A role you submitted",
    why: "Applications can arrive from now on.",
    dismissal: "manual",
    group: "Roles",
  },
  position_reopened: {
    tier: "important",
    affects: "A role you paused",
    why: "Sourcing has resumed.",
    dismissal: "manual",
    group: "Roles",
  },
  position_closed: {
    tier: "important",
    affects: "A role in your workspace",
    why: "No further candidates will be added.",
    dismissal: "manual",
    group: "Roles",
  },
  position_filled: {
    tier: "important",
    affects: "A role in your workspace",
    why: "The role is filled and can be wrapped up.",
    dismissal: "manual",
    group: "Roles",
  },
  position_paused: {
    tier: "informational",
    affects: "A role in your workspace",
    why: "Sourcing is on hold until it is resumed.",
    dismissal: "manual",
    group: "Roles",
  },
  position_updated: {
    tier: "informational",
    affects: "A role in your workspace",
    why: "Requirement changes can affect earlier rankings.",
    dismissal: "manual",
    group: "Roles",
  },
  application_received: {
    tier: "informational",
    affects: "Your application",
    why: "Confirms we have it and nothing else is needed from you.",
    dismissal: "manual",
    group: "Applications",
  },
  candidate_stage_changed: {
    tier: "informational",
    affects: "A candidate's status",
    why: "Keeps the pipeline picture accurate.",
    dismissal: "manual",
    group: "Candidates",
    candidateSensitive: true,
  },
  candidate_processing_completed: {
    tier: "informational",
    affects: "Application processing",
    why: "The application is ready for the next step.",
    dismissal: "manual",
    group: "Processing",
    candidateSensitive: true,
  },
  cv_parsed: {
    tier: "informational",
    affects: "One application document",
    why: "The document was read successfully.",
    dismissal: "manual",
    group: "Documents",
    candidateSensitive: true,
  },
  screening_completed: {
    tier: "informational",
    affects: "An application review",
    why: "Review finished with no open questions.",
    dismissal: "manual",
    group: "Processing",
    candidateSensitive: true,
  },
  sync_completed: {
    tier: "informational",
    affects: "Data shown in your workspace",
    why: "Confirms the figures you see are current.",
    dismissal: "manual",
    group: "Synchronisation",
  },
  scheduled_run_completed: {
    tier: "informational",
    affects: "Automated work on your roles",
    why: "A record that the scheduled run finished.",
    dismissal: "manual",
    group: "Agent runs",
  },
  client_viewed_candidate: {
    tier: "informational",
    affects: "A candidate in this role",
    why: "Shows the client is engaging with what we sent.",
    dismissal: "manual",
    group: "Decisions",
    candidateSensitive: true,
  },
  document_added: {
    tier: "informational",
    affects: "An application record",
    why: "There is a new document to look at when convenient.",
    dismissal: "manual",
    group: "Documents",
    candidateSensitive: true,
  },
  member_removed: {
    tier: "informational",
    affects: "Your team list",
    why: "Access has changed for this workspace.",
    dismissal: "manual",
    group: "Team",
  },
};

/** Fallback so an unmapped event never renders as an untiered mystery row. */
const DEFAULT_RULE: NotificationRule = {
  tier: "informational",
  affects: "Your workspace",
  why: "Recorded so the history stays complete.",
  dismissal: "manual",
  group: "Activity",
};

export function ruleFor(event: EventType | string): NotificationRule {
  return RULES[event as EventType] ?? DEFAULT_RULE;
}

export function tierFor(event: EventType | string): NotificationTier {
  return ruleFor(event).tier;
}

/**
 * Channels where we cannot be sure who is reading — a shared Teams channel, a
 * forwarded email, a push preview on a lock screen — only ever get copy that
 * carries no candidate-specific detail. Permission-checked surfaces (the
 * in-app inbox, which is read under RLS as the recipient) get everything.
 */
export function isSafeForUncertainAudience(event: EventType | string): boolean {
  return !ruleFor(event).candidateSensitive;
}

/** Tier ordering for lists: urgency first, then newest first. */
export function compareByUrgency(
  a: { event_type: string; created_at: string },
  b: { event_type: string; created_at: string },
): number {
  const ta = TIER_META[tierFor(a.event_type)].order;
  const tb = TIER_META[tierFor(b.event_type)].order;
  if (ta !== tb) return ta - tb;
  return b.created_at.localeCompare(a.created_at);
}

export type NotificationRecord = {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
  actor_label?: string | null;
  /** Email delivery state for this notification, when an email was attempted. */
  delivery_state?: string | null;
};

export type NotificationGroup = {
  key: string;
  tier: NotificationTier;
  rule: NotificationRule;
  /** Newest item — the one whose copy and link the row shows. */
  lead: NotificationRecord;
  items: NotificationRecord[];
  unread: number;
  ids: string[];
  latestAt: string;
};

/**
 * Collapses related notifications so one underlying situation reads as one
 * row. Grouping is by (group label, tier, subject record); items about
 * different roles or candidates stay separate because they need separate
 * decisions.
 */
export function groupNotifications(
  items: readonly NotificationRecord[],
): NotificationGroup[] {
  const buckets = new Map<string, NotificationGroup>();

  for (const item of [...items].sort(compareByUrgency)) {
    const rule = ruleFor(item.event_type);
    const subject = item.entity_id ?? "workspace";
    const key = `${rule.tier}:${rule.group}:${subject}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(item);
      existing.ids.push(item.id);
      if (!item.read_at) existing.unread += 1;
      if (item.created_at > existing.latestAt) existing.latestAt = item.created_at;
      continue;
    }
    buckets.set(key, {
      key,
      tier: rule.tier,
      rule,
      lead: item,
      items: [item],
      unread: item.read_at ? 0 : 1,
      ids: [item.id],
      latestAt: item.created_at,
    });
  }

  return [...buckets.values()].sort((a, b) => {
    const d = TIER_META[a.tier].order - TIER_META[b.tier].order;
    return d !== 0 ? d : b.latestAt.localeCompare(a.latestAt);
  });
}

/** Critical items are never clearable from the inbox — only resolvable. */
export function canDismiss(tier: NotificationTier): boolean {
  return tier !== "critical";
}

/** Relative time, stable and readable, with an absolute value in the title. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE });
}

export function actorLabel(
  actorName: string | null | undefined,
  audience: Audience | string | null | undefined,
): string {
  if (actorName && actorName.trim()) return actorName.trim();
  return audience === "admin" ? "TaaSFlow system" : "TaaSFlow";
}
