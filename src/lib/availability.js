// Browser-safe availability + calendar helpers.
// A client sets weekly availability windows ONCE; every interview proposal is
// generated from them, so nobody re-types times per candidate.
export const WEEKDAY_LABELS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function minutesToLabel(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export function labelToMinutes(label) {
    const [h, m] = label.split(":").map((n) => Number(n));
    if (Number.isNaN(h) || Number.isNaN(m))
        return 0;
    return Math.min(1440, Math.max(0, h * 60 + m));
}
export function describeWindow(w) {
    return `${WEEKDAY_LABELS[w.weekday]} ${minutesToLabel(w.start_minute)}–${minutesToLabel(w.end_minute)}`;
}
/** Default windows offered to a client who has never set any: weekdays 09:00–17:00. */
export function defaultWindows(timezone) {
    return [1, 2, 3, 4, 5].map((weekday) => ({
        weekday,
        start_minute: 9 * 60,
        end_minute: 17 * 60,
        timezone,
    }));
}
// ─── Timezone-safe wall-clock → instant ─────────────────────────────────────
function zoneOffsetMinutes(utcMs, timeZone) {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const parts = dtf.formatToParts(new Date(utcMs));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value ?? "0");
    const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
    return (asUTC - utcMs) / 60000;
}
/**
 * Convert a wall-clock date + minute-of-day in `timeZone` into a real instant.
 * DST-safe: the offset is resolved against the candidate instant, twice.
 */
export function zonedWallClockToIso(year, month, // 1-12
day, minuteOfDay, timeZone) {
    const naive = Date.UTC(year, month - 1, day, 0, minuteOfDay);
    let utc = naive - zoneOffsetMinutes(naive, timeZone) * 60000;
    utc = naive - zoneOffsetMinutes(utc, timeZone) * 60000;
    return new Date(utc).toISOString();
}
function zonedParts(utcMs, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
    const weekdayIndex = WEEKDAY_SHORT.indexOf(get("weekday"));
    return {
        year: Number(get("year")),
        month: Number(get("month")),
        day: Number(get("day")),
        weekday: weekdayIndex < 0 ? 0 : weekdayIndex,
    };
}
/**
 * Expand weekly windows into concrete interview start times.
 * Slots never land in the past and always respect the notice period.
 */
export function generateSlots(args) {
    const { windows, timezone, durationMinutes, horizonDays = 10, minNoticeHours = 24, maxSlots = 6, slotStepMinutes = 60, now = new Date(), } = args;
    if (windows.length === 0 || durationMinutes <= 0)
        return [];
    const earliest = now.getTime() + minNoticeHours * 3600000;
    const out = [];
    const perDayCap = Math.max(1, Math.ceil(maxSlots / 3));
    for (let d = 0; d <= horizonDays && out.length < maxSlots; d += 1) {
        const dayMs = now.getTime() + d * 86400000;
        const { year, month, day, weekday } = zonedParts(dayMs, timezone);
        const dayWindows = windows.filter((w) => w.weekday === weekday);
        let perDay = 0;
        for (const w of dayWindows) {
            for (let m = w.start_minute; m + durationMinutes <= w.end_minute && out.length < maxSlots && perDay < perDayCap; m += slotStepMinutes) {
                const iso = zonedWallClockToIso(year, month, day, m, timezone);
                if (new Date(iso).getTime() < earliest)
                    continue;
                if (out.includes(iso))
                    continue;
                out.push(iso);
                perDay += 1;
            }
        }
    }
    return out.sort();
}
// ─── Calendar invite (.ics) ─────────────────────────────────────────────────
function icsEscape(v) {
    return v.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}
function icsStamp(d) {
    return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}
/** Neutral calendar invite — no candidate contact details, no internal scores. */
export function buildIcs(args) {
    const start = new Date(args.startIso);
    const end = new Date(start.getTime() + args.durationMinutes * 60000);
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//TaaSFlow//Interviews//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${args.uid}@taasflow.com`,
        `DTSTAMP:${icsStamp(new Date())}`,
        `DTSTART:${icsStamp(start)}`,
        `DTEND:${icsStamp(end)}`,
        `SUMMARY:${icsEscape(args.title)}`,
        args.location ? `LOCATION:${icsEscape(args.location)}` : null,
        args.description ? `DESCRIPTION:${icsEscape(args.description)}` : null,
        "END:VEVENT",
        "END:VCALENDAR",
    ]
        .filter(Boolean)
        .join("\r\n");
}
export function downloadIcs(filename, ics) {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
