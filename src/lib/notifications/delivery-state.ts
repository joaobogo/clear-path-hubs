/**
 * Email delivery state for a single notification, as the recipient sees it.
 *
 * A notification row that looks identical whether the email landed or bounced
 * is a lie by omission: the person may be waiting on a message that will never
 * arrive. These labels say plainly what happened and what to do about it.
 *
 * Pure and client-safe.
 */

export type DeliveryState = "sent" | "pending" | "failed" | "bounced" | "suppressed";

export type DeliveryNotice = {
  state: DeliveryState;
  /** Short chip label. */
  label: string;
  /** One sentence the recipient can act on. */
  detail: string;
  tone: "neutral" | "warning" | "danger";
  /** Whether this warrants visual weight — successful sends do not. */
  prominent: boolean;
};

const NOTICES: Record<DeliveryState, Omit<DeliveryNotice, "state">> = {
  sent: {
    label: "Emailed",
    detail: "We also emailed this to you.",
    tone: "neutral",
    prominent: false,
  },
  pending: {
    label: "Email sending",
    detail: "The email copy has not gone out yet — this in-app notice is current either way.",
    tone: "neutral",
    prominent: false,
  },
  failed: {
    label: "Email not delivered",
    detail:
      "We could not send the email copy. Nothing is lost — this notice is the record, and our team can resend it.",
    tone: "warning",
    prominent: true,
  },
  bounced: {
    label: "Email bounced",
    detail:
      "Your address rejected the email, so check it is correct in your profile. Resending to the same address will fail again.",
    tone: "danger",
    prominent: true,
  },
  suppressed: {
    label: "Email blocked",
    detail:
      "Emails to your address are blocked — usually after an unsubscribe or an earlier bounce. Update your address or resubscribe to receive them again.",
    tone: "warning",
    prominent: true,
  },
};

/** Maps a `notification_deliveries.status` value onto a recipient-facing state. */
export function normaliseDeliveryStatus(status: string | null | undefined): DeliveryState | null {
  switch ((status ?? "").toLowerCase()) {
    case "sent":
    case "delivered":
      return "sent";
    case "queued":
    case "pending":
    case "sending":
      return "pending";
    case "failed":
    case "rejected":
    case "rate_limited":
      return "failed";
    case "bounced":
    case "complained":
      return "bounced";
    case "suppressed":
      return "suppressed";
    default:
      return null;
  }
}

export function deliveryNotice(state: DeliveryState | null | undefined): DeliveryNotice | null {
  if (!state) return null;
  return { state, ...NOTICES[state] };
}

export function deliveryChipClass(tone: DeliveryNotice["tone"]): string {
  if (tone === "danger") return "taas-bg-danger-soft taas-fg-danger taas-bd-danger";
  if (tone === "warning") return "taas-bg-warning-soft taas-fg-warning taas-bd-warning";
  return "taas-bg-neutral-soft taas-fg-neutral taas-bd-neutral";
}
