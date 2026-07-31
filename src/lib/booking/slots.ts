/**
 * Discovery-call slot maths. Browser-safe and pure so the booking page and the
 * server agree on exactly which times exist — we never offer a time we can't keep.
 */

export const CALL_MINUTES = 30;
/** Working window, in UTC hours. */
export const CALL_DAY_START_HOUR_UTC = 9;
export const CALL_DAY_END_HOUR_UTC = 17;
/** We don't offer a slot inside this window — the team needs notice. */
export const MIN_LEAD_MINUTES = 120;
/** How far ahead we open the diary. */
export const BOOKING_HORIZON_DAYS = 10;

export type CallSlot = {
  /** ISO start, always on a clean 30-minute boundary in UTC. */
  start: string;
  end: string;
};

function isWeekday(d: Date) {
  const day = d.getUTCDay();
  return day !== 0 && day !== 6;
}

/** Every slot our team could take, before bookings are removed. */
export function generateSlots(from: Date = new Date()): CallSlot[] {
  const slots: CallSlot[] = [];
  const earliest = new Date(from.getTime() + MIN_LEAD_MINUTES * 60_000);
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 0, 0, 0, 0),
  );

  for (let day = 0; day <= BOOKING_HORIZON_DAYS; day += 1) {
    const dayStart = new Date(cursor.getTime() + day * 86_400_000);
    if (!isWeekday(dayStart)) continue;

    for (let hour = CALL_DAY_START_HOUR_UTC; hour < CALL_DAY_END_HOUR_UTC; hour += 1) {
      for (const minute of [0, 30]) {
        const start = new Date(
          Date.UTC(
            dayStart.getUTCFullYear(),
            dayStart.getUTCMonth(),
            dayStart.getUTCDate(),
            hour,
            minute,
          ),
        );
        if (start < earliest) continue;
        slots.push({
          start: start.toISOString(),
          end: new Date(start.getTime() + CALL_MINUTES * 60_000).toISOString(),
        });
      }
    }
  }
  return slots;
}

export function removeTaken(slots: CallSlot[], takenIso: readonly string[]): CallSlot[] {
  const taken = new Set(takenIso.map((t) => new Date(t).toISOString()));
  return slots.filter((s) => !taken.has(s.start));
}

/** Group by calendar day for rendering. */
export function groupByDay(
  slots: readonly CallSlot[],
  timeZone: string,
): { dayKey: string; dayLabel: string; slots: CallSlot[] }[] {
  const dayFormat = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  });
  const groups = new Map<string, { dayKey: string; dayLabel: string; slots: CallSlot[] }>();
  for (const slot of slots) {
    const label = dayFormat.format(new Date(slot.start));
    const existing = groups.get(label);
    if (existing) existing.slots.push(slot);
    else groups.set(label, { dayKey: label, dayLabel: label, slots: [slot] });
  }
  return [...groups.values()];
}

export function formatSlotTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

export function formatSlotFull(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Plain-language countdown to the call. */
export function countdownTo(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  if (diffMs <= 0) return "Happening now";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `In ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `In ${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `In ${days} day${days === 1 ? "" : "s"}`;
}
