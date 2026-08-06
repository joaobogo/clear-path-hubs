/**
 * Per-event notification preferences for candidates.
 *
 * A candidate can mute anything that is not needed to run their own
 * application. Events marked `required` stay on because switching them off
 * would mean we silently drop a message the candidate has to act on.
 */

export type CandidateNotificationEvent = {
  key: string;
  label: string;
  description: string;
  required: boolean;
  defaultOn: boolean;
};

export const CANDIDATE_NOTIFICATION_EVENTS: CandidateNotificationEvent[] = [
  {
    key: "application_received",
    label: "Application received",
    description: "One confirmation with your reference, right after you apply.",
    required: true,
    defaultOn: true,
  },
  {
    key: "action_needed",
    label: "Something needs your reply",
    description: "A question or document the hiring team is waiting on, with the date it is needed by.",
    required: true,
    defaultOn: true,
  },
  {
    key: "interview_invitation",
    label: "Interview times and changes",
    description: "Proposed times, confirmations, reschedules and cancellations.",
    required: true,
    defaultOn: true,
  },
  {
    key: "status_changed",
    label: "Status changes",
    description: "When your application moves forward, or the role closes.",
    required: false,
    defaultOn: true,
  },
  {
    key: "messages",
    label: "Messages from our team",
    description: "Replies in your message thread.",
    required: false,
    defaultOn: true,
  },
  {
    key: "reminders",
    label: "Reminders",
    description: "At most two nudges about something already waiting on you. Never a daily nudge.",
    required: false,
    defaultOn: true,
  },
  {
    key: "new_roles",
    label: "New roles that match",
    description: "Only if you are in the talent network. Off by default.",
    required: false,
    defaultOn: false,
  },
  {
    key: "product_updates",
    label: "Occasional product updates",
    description: "A few times a year, never more.",
    required: false,
    defaultOn: false,
  },
];

export const CANDIDATE_NOTIFICATION_EVENT_KEYS = CANDIDATE_NOTIFICATION_EVENTS.map(
  (e) => e.key,
);

/** Resolves the stored consent blob into a complete per-event map. */
export function resolveNotificationPrefs(
  consent: Record<string, unknown> | null | undefined,
): Record<string, boolean> {
  const stored = (consent?.["notification_events"] ?? {}) as Record<string, unknown>;
  const legacyEmailOff = consent?.["notifications_email"] === false;
  const out: Record<string, boolean> = {};
  for (const event of CANDIDATE_NOTIFICATION_EVENTS) {
    if (event.required) {
      out[event.key] = true;
      continue;
    }
    const value = stored[event.key];
    if (typeof value === "boolean") {
      out[event.key] = value;
      continue;
    }
    // Fall back to the older coarse switches so nobody silently starts
    // receiving mail they had turned off.
    if (event.key === "product_updates") {
      out[event.key] = consent?.["marketing_opt_in"] === true;
    } else if (event.key === "new_roles") {
      out[event.key] = consent?.["network_opt_in"] === true;
    } else {
      out[event.key] = legacyEmailOff ? false : event.defaultOn;
    }
  }
  return out;
}

/** True when a given event may be sent to this candidate. */
export function notificationAllowed(
  consent: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  const event = CANDIDATE_NOTIFICATION_EVENTS.find((e) => e.key === key);
  if (!event) return true;
  if (event.required) return true;
  return resolveNotificationPrefs(consent)[key] === true;
}
