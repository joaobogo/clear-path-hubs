/**
 * Slot maths for the native scheduler — pure, isomorphic, dependency-free.
 *
 * Availability is generated from business hours expressed in the HOST timezone
 * and returned as absolute UTC instants, so the browser can render them in any
 * timezone without the two sides ever disagreeing.
 */

export type Slot = { start: string; end: string };

/** One bookable window on one weekday (0 = Sunday), host-local minutes. */
export type DayWindow = { weekday: number; startMinute: number; endMinute: number };

export type SlotRules = {
  hostTimezone: string;
  /** Minutes from midnight, host time. Used when `windows` is absent. */
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  /** Open days to generate, counting from today, host time. */
  businessDays: number;
  /** Nothing bookable inside this window from `now`. */
  leadMinutes: number;
  /**
   * Per-weekday availability from org_scheduling_settings. When omitted we fall
   * back to Mon–Fri `startMinute`–`endMinute`, so booking works with no setup.
   */
  windows?: readonly DayWindow[];
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

function weekdayOf(day: CalendarDay): number {
  return new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
}

/** The bookable windows for a given day, honouring configured availability. */
function windowsFor(rules: SlotRules, day: CalendarDay): DayWindow[] {
  const weekday = weekdayOf(day);
  if (rules.windows && rules.windows.length > 0) {
    return rules.windows.filter((w) => w.weekday === weekday);
  }
  // Default: Mon–Fri business hours.
  if (weekday < 1 || weekday > 5) return [];
  return [{ weekday, startMinute: rules.startMinute, endMinute: rules.endMinute }];
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

  while (opened < rules.businessDays && guard < 120) {
    guard += 1;
    const windows = windowsFor(rules, day);
    if (windows.length > 0) {
      opened += 1;
      for (const window of windows) {
        for (
          let minute = window.startMinute;
          minute + rules.slotMinutes <= window.endMinute;
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
    }
    day = addDays(day, 1);
  }
  return slots.sort((a, b) => a.start.localeCompare(b.start));
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

/* ------------------------------------------------------------- month grid -- */

export type MonthCell = {
  /** en-CA day key, or null for the leading/trailing padding cells. */
  key: string | null;
  dayOfMonth: number | null;
  slotCount: number;
};

export type MonthGrid = {
  /** First of the month, as a day key — the grid's identity. */
  monthKey: string;
  label: string;
  /** Mon-first rows of 7 cells. */
  weeks: MonthCell[][];
};

/** Month key ("YYYY-MM") for an instant, in `tz`. */
export function monthKeyOf(iso: string, tz: string): string {
  return dayKey(iso, tz).slice(0, 7);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Builds a Mon-first month grid, tagging each day with how many slots are open.
 * Days with a zero count render as non-selectable, which is what makes the
 * calendar honest: you can only click a date we can actually meet on.
 */
export function buildMonthGrid(monthKey: string, slots: Slot[], tz: string): MonthGrid {
  const [year, month] = monthKey.split("-").map(Number) as [number, number];
  const counts = new Map<string, number>();
  for (const slot of slots) {
    const key = dayKey(slot.start, tz);
    if (key.startsWith(monthKey)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = daysInMonth(year, month);
  // Monday-first offset: JS getUTCDay() is Sunday-first.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lead = (firstWeekday + 6) % 7;

  const cells: MonthCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push({ key: null, dayOfMonth: null, slotCount: 0 });
  for (let d = 1; d <= total; d += 1) {
    const key = `${monthKey}-${String(d).padStart(2, "0")}`;
    cells.push({ key, dayOfMonth: d, slotCount: counts.get(key) ?? 0 });
  }
  while (cells.length % 7 !== 0) cells.push({ key: null, dayOfMonth: null, slotCount: 0 });

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return { monthKey, label, weeks };
}

/** Ordered month keys that contain at least one open slot. */
export function monthsWithSlots(slots: Slot[], tz: string): string[] {
  const keys = new Set<string>();
  for (const slot of slots) keys.add(monthKeyOf(slot.start, tz));
  return [...keys].sort();
}

/** Short "Wed 12 Aug" heading for the chosen day's slot column. */
export function shortDayLabel(dayKeyValue: string): string {
  const [year, month, day] = dayKeyValue.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Human offset label, e.g. "GMT+2", for the timezone selector. */
export function tzAbbreviation(tz: string, at: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}
