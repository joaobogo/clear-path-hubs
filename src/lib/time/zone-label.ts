/**
 * Canonical timezone rendering.
 *
 * A time without its zone is a guess. Every interview time we show — web, email
 * or calendar file — must carry the recipient's zone and the UTC offset that
 * applies on that date, because offsets move with daylight saving and "10:00
 * (Europe/Lisbon)" in January is not the same instant as in July.
 *
 * Pure and client-safe: no database, no server-only imports.
 */

export const FALLBACK_ZONE = "UTC";

export type ZonedTime = {
  /** e.g. "Tuesday 14 May, 10:00" */
  timeLabel: string;
  /** IANA zone actually used (falls back to UTC when the input is unusable). */
  zone: string;
  /** e.g. "GMT+1" — resolved for this instant, so DST is respected. */
  offsetLabel: string;
  /** e.g. "Europe/Lisbon, GMT+1" */
  zoneLabel: string;
  /** e.g. "Tuesday 14 May, 10:00 (Europe/Lisbon, GMT+1)" */
  full: string;
  /** True when we could not honour the requested zone and fell back to UTC. */
  fellBack: boolean;
};

function safeZone(zone: string | null | undefined): { zone: string; fellBack: boolean } {
  const candidate = (zone ?? "").trim();
  if (!candidate) return { zone: FALLBACK_ZONE, fellBack: !!zone };
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: candidate }).format(new Date());
    return { zone: candidate, fellBack: false };
  } catch {
    return { zone: FALLBACK_ZONE, fellBack: true };
  }
}

/** "GMT+1" / "GMT-3" / "GMT" for the given instant in the given zone. */
export function offsetLabel(iso: string | Date, zone: string): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    if (name) return name.replace("UTC", "GMT");
  } catch {
    /* falls through to the manual calculation below */
  }
  return "GMT";
}

export function formatZonedTime(
  iso: string | Date | null | undefined,
  zone: string | null | undefined,
  options?: { includeYear?: boolean },
): ZonedTime | null {
  if (!iso) return null;
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const resolved = safeZone(zone);
  let timeLabel: string;
  try {
    timeLabel = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      ...(options?.includeYear ? { year: "numeric" as const } : {}),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: resolved.zone,
    }).format(date);
  } catch {
    timeLabel = date.toISOString().replace("T", " ").slice(0, 16);
  }

  const offset = offsetLabel(date, resolved.zone);
  const zoneLabel = `${resolved.zone}, ${offset}`;
  return {
    timeLabel,
    zone: resolved.zone,
    offsetLabel: offset,
    zoneLabel,
    full: `${timeLabel} (${zoneLabel})`,
    fellBack: resolved.fellBack,
  };
}

/**
 * The zone the recipient should see, in order of trust: their own stored
 * preference, then the interview's zone, then UTC — never the viewer's browser
 * zone on the server, which would silently be ours rather than theirs.
 */
export function resolveRecipientZone(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const resolved = safeZone(candidate);
    if (!resolved.fellBack && resolved.zone !== FALLBACK_ZONE) return resolved.zone;
  }
  return FALLBACK_ZONE;
}

/** One-line note for emails and calendar descriptions. */
export function zoneNote(zoned: ZonedTime): string {
  return `All times are shown in ${zoneLabelSentence(zoned)}.`;
}

export function zoneLabelSentence(zoned: ZonedTime): string {
  return `${zoned.zone} (${zoned.offsetLabel})`;
}
