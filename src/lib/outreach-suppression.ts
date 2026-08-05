/**
 * Contact suppression — the shape the UI mirrors.
 *
 * Enforcement lives in the database: `outreach_contact_allowed` decides, and a
 * BEFORE INSERT trigger on `outreach_touches` refuses any outbound touch it
 * blocks. Nothing here is a gate; it only explains what the database already
 * decided so a person is never messaged by accident.
 */

export const SUPPRESSION_CHANNELS = ["email", "linkedin", "sms", "phone"] as const;
export type SuppressionChannel = (typeof SUPPRESSION_CHANNELS)[number];

export const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  sms: "SMS",
  phone: "Phone",
};

export const BLOCK_LABEL: Record<string, string> = {
  opted_out: "Opted out",
  already_replied: "Already replied",
  in_process: "Already in process",
  frequency_cap: "Contacted too recently",
  channel_disabled: "Channel paused",
  agent_switched_off: "Outreach agent off",
  unknown: "Contact status unavailable",
};

export const BLOCK_EXPLANATION: Record<string, string> = {
  opted_out:
    "This person asked not to be contacted. Sending is blocked until an exception is granted and recorded.",
  already_replied: "They have replied, so their sequence has stopped.",
  in_process: "They are already in process with this client, so outreach has stopped.",
  frequency_cap: "They were contacted on this channel inside the current window.",
  channel_disabled: "This channel is paused for the workspace.",
  agent_switched_off: "The Outreach agent is switched off.",
  unknown:
    "We could not confirm whether this person may be contacted, so sending is blocked. Retry, and if it keeps failing treat them as suppressed.",
};

export type ChannelVerdict = {
  channel: SuppressionChannel;
  label: string;
  allowed: boolean;
  reason: string | null;
  reasonLabel: string | null;
  explanation: string | null;
};

export type OptOutEntry = {
  id: string;
  channel: string | null;
  channelLabel: string;
  scope: "global" | "organization";
  reason: string | null;
  created_at: string;
  matched_by: "profile" | "email";
};

export type SuppressionException = {
  id: string;
  reason: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type ContactStatus = {
  candidate_profile_id: string;
  organization_id: string;
  /** true when at least one opt-out record exists for this person. */
  suppressed: boolean;
  optOuts: OptOutEntry[];
  exceptions: SuppressionException[];
  verdicts: ChannelVerdict[];
  /** true when every channel is blocked. */
  fullyBlocked: boolean;
};

/** The qualifier the exception record hangs off, so the DB guard can find it. */
export const SUPPRESSION_QUALIFIER_KEY = "outreach_contact_suppression";
export const SUPPRESSION_QUALIFIER_LABEL = "Outreach contact suppression";

export function scopeLabel(scope: "global" | "organization"): string {
  return scope === "global" ? "All clients" : "This client only";
}

/** A verdict we could not read is a block, never a pass. */
export function failClosedVerdict(channel: SuppressionChannel): ChannelVerdict {
  return {
    channel,
    label: CHANNEL_LABEL[channel] ?? channel,
    allowed: false,
    reason: "unknown",
    reasonLabel: BLOCK_LABEL["unknown"] ?? "Contact status unavailable",
    explanation: BLOCK_EXPLANATION["unknown"] ?? null,
  };
}
