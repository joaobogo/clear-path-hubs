/**
 * The one notification event a role's status change raises.
 *
 * The status action used to raise two events for the same change: one linked
 * to the admin page, one to the client page. Both fanned out to everyone, so a
 * client got "Your role is live" twice, the first linking to an admin page
 * they cannot open (24 Nov 2026). One event now reaches both sides, each with
 * its own link, and a repeat click that changes nothing announces nothing.
 */
import type { EventType } from "@/lib/events";

const STATUS_EVENTS: Record<string, EventType> = {
  submit: "intake_submitted",
  approve: "position_approved",
  activate: "position_activated",
  reopen: "position_reopened",
  pause: "position_paused",
  mark_filled: "position_filled",
  close: "position_closed",
  request_clarification: "clarification_requested",
};

export type StatusChangeEvent = {
  event: EventType;
  scope: string;
  link_path: string;
  link_path_by_audience: { client: string; admin: string };
  payload: { title: string | null; reason: string | null; note: string | null };
};

export function statusChangeEvent(i: {
  positionId: string;
  action: string;
  beforeStatus: string | null;
  nextStatus: string;
  title?: string | null;
  reason?: string | null;
  now?: Date;
}): StatusChangeEvent | null {
  const event = STATUS_EVENTS[i.action];
  if (!event) return null;
  // Nothing changed (a second click on the same button): nothing to announce.
  if (i.beforeStatus === i.nextStatus) return null;
  const reason = i.reason?.trim() ? i.reason : null;
  return {
    event,
    // One event per change: the time makes a later pause after a resume a new
    // event, not a repeat of the first.
    scope: `${i.positionId}:${i.action}:${(i.now ?? new Date()).getTime()}`,
    link_path: `/admin/positions/${i.positionId}`,
    link_path_by_audience: {
      client: `/client/positions/${i.positionId}`,
      admin: `/admin/positions/${i.positionId}`,
    },
    payload: { title: i.title ?? null, reason, note: reason },
  };
}
