/**
 * The scheduler step — a Calendly-shaped, fully native "pick a time".
 *
 * Left rail: what the meeting actually is (host, duration, timezone).
 * Right rail: a month grid where only dates we can genuinely meet on are
 * clickable, then that day's slots as a vertical list.
 *
 * Everything is derived from the UTC instants the server offered, so changing
 * timezone re-renders instantly without another round trip and without ever
 * showing a time we don't hold open.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Globe, Loader2, User, Video } from "lucide-react";
import {
  buildMonthGrid,
  dayKey,
  monthKeyOf,
  monthsWithSlots,
  rangeLabel,
  shortDayLabel,
  timeLabel,
  tzAbbreviation,
  type Slot,
} from "@/lib/booking/slots";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type SchedulerPanelProps = {
  slots: Slot[];
  timezone: string;
  timezoneChoices: readonly string[];
  onTimezoneChange: (tz: string) => void;
  onPick: (slot: Slot) => void;
  pending: boolean;
  meetingName: string;
  durationLabel: string;
  hostName: string;
};

export function SchedulerPanel({
  slots,
  timezone,
  timezoneChoices,
  onTimezoneChange,
  onPick,
  pending,
  meetingName,
  durationLabel,
  hostName,
}: SchedulerPanelProps) {
  const months = useMemo(() => monthsWithSlots(slots, timezone), [slots, timezone]);
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // The first month with availability is the sensible landing month, and it can
  // change when the timezone shifts a slot across a month boundary.
  useEffect(() => {
    if (months.length === 0) {
      setMonthKey(null);
      return;
    }
    setMonthKey((current) => (current && months.includes(current) ? current : months[0]!));
  }, [months]);

  const grid = useMemo(
    () => (monthKey ? buildMonthGrid(monthKey, slots, timezone) : null),
    [monthKey, slots, timezone],
  );

  const openDays = useMemo(() => {
    const keys = new Set<string>();
    for (const slot of slots) keys.add(dayKey(slot.start, timezone));
    return keys;
  }, [slots, timezone]);

  // Keep the selection valid: a timezone change can empty the chosen day.
  useEffect(() => {
    if (selectedDay && openDays.has(selectedDay)) return;
    const first = [...openDays].sort()[0] ?? null;
    setSelectedDay(first && monthKey && first.startsWith(monthKey) ? first : null);
  }, [openDays, monthKey, selectedDay]);

  const daySlots = useMemo(
    () =>
      selectedDay
        ? slots
            .filter((slot) => dayKey(slot.start, timezone) === selectedDay)
            .sort((a, b) => a.start.localeCompare(b.start))
        : [],
    [slots, selectedDay, timezone],
  );

  const monthIndex = monthKey ? months.indexOf(monthKey) : -1;
  const offset = tzAbbreviation(timezone);

  return (
    <div className="grid gap-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm md:grid-cols-[minmax(0,280px)_1fr]">
      {/* ---------------------------------------------------- meeting summary */}
      <aside className="border-b border-border p-6 md:border-b-0 md:border-r">
        <p className="text-sm font-medium text-muted-foreground">{hostName}</p>
        <h2 className="mt-1 text-xl font-semibold leading-tight tracking-tight">{meetingName}</h2>

        <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
          <li className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            {durationLabel}
          </li>
          <li className="flex items-center gap-2.5">
            <Video className="h-4 w-4 shrink-0" aria-hidden />
            Online — link in your confirmation
          </li>
          <li className="flex items-center gap-2.5">
            <User className="h-4 w-4 shrink-0" aria-hidden />
            One of our hiring leads
          </li>
        </ul>

        <div className="mt-6 space-y-1.5">
          <Label htmlFor="timezone" className="flex items-center gap-2 text-xs">
            <Globe className="h-3.5 w-3.5" aria-hidden /> Timezone
          </Label>
          <select
            id="timezone"
            data-testid="timezone-select"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={timezone}
            onChange={(event) => onTimezoneChange(event.target.value)}
          >
            {timezoneChoices.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Times shown in {timezone.replace(/_/g, " ")}
            {offset ? ` (${offset})` : ""}
          </p>
        </div>
      </aside>

      {/* --------------------------------------------------- calendar + slots */}
      <div className="grid gap-0 sm:grid-cols-[1fr_minmax(0,200px)]">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" data-testid="calendar-month">
              {grid?.label ?? "No open dates"}
            </h3>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                disabled={monthIndex <= 0}
                onClick={() => setMonthKey(months[monthIndex - 1] ?? monthKey)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Next month"
                disabled={monthIndex < 0 || monthIndex >= months.length - 1}
                onClick={() => setMonthKey(months[monthIndex + 1] ?? monthKey)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {WEEKDAY_HEADS.map((head) => (
              <span key={head}>{head}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1" data-testid="calendar-grid">
            {(grid?.weeks ?? []).flat().map((cell, index) => {
              if (!cell.key) return <span key={`pad-${index}`} aria-hidden />;
              const open = cell.slotCount > 0;
              const active = cell.key === selectedDay;
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={!open || pending}
                  data-day={cell.key}
                  data-open={open ? "true" : "false"}
                  aria-pressed={active}
                  aria-label={`${shortDayLabel(cell.key)}${open ? "" : " — no times"}`}
                  onClick={() => setSelectedDay(cell.key)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-full text-sm transition-colors",
                    open
                      ? "font-semibold text-primary hover:bg-primary/10"
                      : "cursor-default text-muted-foreground/40",
                    active && open && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  {cell.dayOfMonth}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border p-6 sm:border-l sm:border-t-0">
          {selectedDay ? (
            <>
              <h3 className="text-sm font-semibold" data-testid="selected-day">
                {shortDayLabel(selectedDay)}
              </h3>
              <div
                className="mt-3 flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1"
                data-testid="slot-list"
              >
                {daySlots.map((slot) => (
                  <Button
                    key={slot.start}
                    type="button"
                    variant="outline"
                    disabled={pending}
                    data-slot-start={slot.start}
                    onClick={() => onPick(slot)}
                    className="h-11 w-full justify-center border-primary/40 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                    title={rangeLabel(slot.start, slot.end, timezone)}
                  >
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      timeLabel(slot.start, timezone)
                    )}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pick a highlighted date to see its times.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Month key of the first available slot — used to preselect on first paint. */
export function firstMonthKey(slots: Slot[], tz: string): string | null {
  return slots.length > 0 ? monthKeyOf(slots[0]!.start, tz) : null;
}
