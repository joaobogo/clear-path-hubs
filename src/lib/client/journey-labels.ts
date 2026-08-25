/**
 * Client-facing journey vocabulary.
 *
 * The journey stream carries internal stage words and raw database keys
 * (source channels, fit bands, processing states). Clients must never see
 * either. This module maps every value we emit to a plain sentence and drops
 * internal-only sub-lines.
 *
 * Rule: if a value still looks like a key (snake_case), it is humanised
 * generically rather than rendered raw.
 */
import type { JourneyEvent } from "@/lib/journey.functions";

/** Event titles, rewritten for client eyes. */
const EVENT_LABEL: Record<string, string> = {
  Screened: "CV reviewed",
  Ranked: "Scored",
  Enriched: "Background checked",
  Sourced: "Found by our team",
  "Delivered to your workspace": "Delivered to your workspace",
};

/** Application sources and other raw keys that may arrive as a detail line. */
const DETAIL_LABEL: Record<string, string> = {
  public_job_board: "Applied via the public job board",
  job_board: "Applied via a job board",
  referral: "Referred by someone in your network",
  direct: "Applied directly",
  career_site: "Applied through your careers page",
  inbound: "Applied directly",
  outbound: "Contacted by our team",
  sourced: "Found by our team",
  linkedin: "Sourced on LinkedIn",
  email: "Contacted by email",
};

/**
 * Fit bands, in the workspace's own four-label fit vocabulary.
 * Legacy band words (exceptional, good, mixed, weak, …) collapse onto the
 * current four: Top, Strong, Consider, Not recommended.
 */
const BAND_LABEL: Record<string, string> = {
  exceptional: "Top",
  unicorn: "Top",
  top: "Top",
  top_fit: "Top",
  strong: "Strong",
  strong_fit: "Strong",
  good: "Strong",
  good_fit: "Strong",
  consider: "Consider",
  mixed: "Consider",
  moderate: "Consider",
  worth_considering: "Consider",
  weak: "Not recommended",
  poor: "Not recommended",
  not_a_fit: "Not recommended",
  not_recommended: "Not recommended",
};

/** Band words that may arrive followed by the noun "fit" / "match". */
const BAND_NOUNS = new Set(["fit", "match"]);

/** Detail lines that describe internal machinery — never shown to clients. */
const HIDDEN_DETAILS = new Set([
  "visible to client",
  "evidence assembled",
  "cv parsed and validated",
]);

/** Sentence-cases anything that still looks like a key. */
function humanizeKey(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim();
  if (!words) return "";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function mapBands(text: string): string {
  // Case-insensitive so legacy rows ("Mixed Fit", "top", "STRONG") normalise
  // to the same four labels with the same capitals as the rest of the app.
  return text.replace(
    /\b([A-Za-z][A-Za-z_]*)(\s+(fit|match))?\b/gi,
    (whole, word: string, _tail: string | undefined, noun: string | undefined) => {
      const mapped = BAND_LABEL[word.toLowerCase()];
      if (!mapped) return whole;
      if (noun && !BAND_NOUNS.has(noun.toLowerCase())) return whole;
      return mapped;
    },
  );
}

/** One detail line, client-safe. Returns null when the line must be dropped. */
export function clientJourneyDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const raw = detail.trim();
  if (!raw) return null;
  if (HIDDEN_DETAILS.has(raw.toLowerCase())) return null;

  const direct = DETAIL_LABEL[raw.toLowerCase()];
  if (direct) return direct;

  const band = BAND_LABEL[raw.toLowerCase()];
  if (band) return band;

  // Composite lines such as "Score 60 · consider".
  const withBands = mapBands(raw);
  if (withBands !== raw) return withBands;

  // Anything left that reads like a key gets sentence-cased.
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(raw)) return humanizeKey(raw);
  return raw;
}

/** One event title, client-safe. */
export function clientJourneyLabel(label: string): string {
  const mapped = EVENT_LABEL[label];
  if (mapped) return mapped;
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(label)) return humanizeKey(label);
  return label;
}

/** Rewrites a whole journey stream for a client surface. */
export function toClientJourney(events: JourneyEvent[]): JourneyEvent[] {
  return events.map((e) => ({
    ...e,
    label: clientJourneyLabel(e.label),
    detail: clientJourneyDetail(e.detail),
  }));
}
