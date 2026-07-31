/**
 * Prompt 18 — the intensity dial.
 *
 * Three settings, one per role. Each one changes real work: how many people we
 * source, how often we reach out, and how big a shortlist you get. The effect
 * is written in plain words so nobody has to guess before they confirm.
 *
 * Client-safe: pure data, no server imports.
 */

export const INTENSITIES = ["steady", "standard", "aggressive"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export type IntensityPreset = {
  key: Intensity;
  label: string;
  summary: string;
  /** Written out for the confirm step. Three lines, no jargon. */
  effects: { label: string; value: string }[];
  bestFor: string;
};

export const INTENSITY_PRESETS: Record<Intensity, IntensityPreset> = {
  steady: {
    key: "steady",
    label: "Steady",
    summary: "Fewer people, contacted less often, a tighter shortlist.",
    effects: [
      { label: "Sourcing volume", value: "About half our standard weekly volume" },
      { label: "Outreach cadence", value: "One contact per person per two weeks" },
      { label: "Shortlist size", value: "Up to 3 candidates at a time" },
    ],
    bestFor: "A quiet search, a confidential role, or a team with little time to review.",
  },
  standard: {
    key: "standard",
    label: "Standard",
    summary: "Our normal pace. Most roles sit here.",
    effects: [
      { label: "Sourcing volume", value: "Our standard weekly volume" },
      { label: "Outreach cadence", value: "One contact per person per week" },
      { label: "Shortlist size", value: "Up to 5 candidates at a time" },
    ],
    bestFor: "Almost every role.",
  },
  aggressive: {
    key: "aggressive",
    label: "Aggressive",
    summary: "More people, contacted more often, a wider shortlist to review.",
    effects: [
      { label: "Sourcing volume", value: "Roughly double our standard weekly volume" },
      { label: "Outreach cadence", value: "Up to two contacts per person per week" },
      { label: "Shortlist size", value: "Up to 8 candidates at a time" },
    ],
    bestFor: "An urgent hire where your team can review candidates quickly.",
  },
};

export function intensityLabel(v: string | null | undefined): string {
  return INTENSITY_PRESETS[(v ?? "standard") as Intensity]?.label ?? "Standard";
}

/** The sentence shown before a change is confirmed. */
export function intensityChangeSentence(from: Intensity, to: Intensity): string {
  if (from === to) return "Nothing changes.";
  const a = INTENSITY_PRESETS[from];
  const b = INTENSITY_PRESETS[to];
  return `Moving this role from ${a.label.toLowerCase()} to ${b.label.toLowerCase()} takes effect on the next run. ${b.summary}`;
}
