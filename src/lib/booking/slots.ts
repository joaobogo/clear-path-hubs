/**
 * Slot maths for the native scheduler — pure, isomorphic, dependency-free.
 *
 * Availability is generated from business hours expressed in the HOST timezone
 * and returned as absolute UTC instants, so the browser can render them in any
 * timezone without the two sides ever disagreeing.
 */

export type Slot = { start: string; end: string };

export type SlotRules = {
  hostTimezone: string;
  /** Minutes from midnight, host time. */
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  /** Business days (Mon–Fri) to open, counting from today, host time. */
  businessDays: number;
  /** Nothing bookable inside this window from `now`. */
  leadMinutes: number;
};

type CalendarDay = { year: number; month: number; day: number };

/** Offset of `tz` from UTC at `date`, in milliseconds (positive = east of UTC). */
export function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** The calendar day `date` falls on, in `tz`. */
export function calendarDayIn(date: Date, tz: string): CalendarDay {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Absolute instant for a wall-clock time on `day` in `tz`. */
export function zonedToUtc(day: CalendarDay, minuteOfDay: number, tz: string): Date {
  const naive = Date.UTC(
    day.year,
    day.month - 1,
    day.day,
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
    0,
  );
  // One correction pass is enough outside the DST transition hour, and a second
  // pass settles the transition itself.
  let guess = naive - tzOffsetMs(new Date(naive), tz);
  guess = naive - tzOffsetMs(new Date(guess), tz);
  return new Date(guess);
}

function addDays(day: CalendarDay, count: number): CalendarDay {
  const next = new Date(Date.UTC(day.year, day.month - 1, day.day + count));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function isBusinessDay(day: CalendarDay): boolean {
  const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

/**
 * Every slot the calendar offers, before booked slots are removed.
 * Deterministic for a given `now`, which is what makes it testable.
 */
export function generateSlots(rules: SlotRules, now: Date = new Date()): Slot[] {
  const earliest = now.getTime() + rules.leadMinutes * 60_000;
  const slots: Slot[] = [];
  let day = calendarDayIn(now, rules.hostTimezone);
  let opened = 0;
  let guard = 0;

  while (opened < rules.businessDays && guard < 90) {
    guard += 1;
    if (isBusinessDay(day)) {
      opened += 1;
      for (
        let minute = rules.startMinute;
        minute + rules.slotMinutes <= rules.endMinute;
        minute += rules.slotMinutes
      ) {
        const start = zonedToUtc(day, minute, rules.hostTimezone);
        if (start.getTime() < earliest) continue;
        slots.push({
          start: start.toISOString(),
          end: new Date(start.getTime() + rules.slotMinutes * 60_000).toISOString(),
        });
      }
    }
    day = addDays(day, 1);
  }
  return slots;
}

export type BusyInterval = { start: string; end: string };

/** Removes any slot that overlaps a taken interval. Half-open comparison. */
export function removeBooked(slots: Slot[], busy: BusyInterval[]): Slot[] {
  if (busy.length === 0) return slots;
  const ranges = busy
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter((b) => Number.isFinite(b.start) && Number.isFinite(b.end));
  return slots.filter((slot) => {
    const start = Date.parse(slot.start);
    const end = Date.parse(slot.end);
    return !ranges.some((range) => start < range.end && end > range.start);
  });
}

/* --------------------------------------------------------- presentation -- */

export function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function dayLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

export function timeLabel(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function rangeLabel(startIso: string, endIso: string, tz: string): string {
  return `${timeLabel(startIso, tz)}–${timeLabel(endIso, tz)}`;
}

export function fullLabel(startIso: string, endIso: string, tz: string): string {
  return `${dayLabel(startIso, tz)}, ${rangeLabel(startIso, endIso, tz)} (${tz})`;
}

/** Groups slots into ordered days for rendering. */
export function groupByDay(
  slots: Slot[],
  tz: string,
): Array<{ key: string; label: string; slots: Slot[] }> {
  const buckets = new Map<string, { key: string; label: string; slots: Slot[] }>();
  for (const slot of slots) {
    const key = dayKey(slot.start, tz);
    const bucket = buckets.get(key) ?? { key, label: dayLabel(slot.start, tz), slots: [] };
    bucket.slots.push(slot);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Detects the visitor's timezone, falling back to UTC. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** True when `tz` is a timezone this runtime understands. */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
