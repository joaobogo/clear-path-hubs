/**
 * Public performance figures, and where each one comes from.
 *
 * /case-studies published POSITIONS DELIVERED 175+, CITIES ENGAGED 18, MEDIAN
 * TIME TO SHORTLIST 7d, CLIENT SHORTLIST RATING 9.1/10, 12-MONTH RETENTION 92%
 * and OFFER ACCEPTANCE 86%, with one page-level hedge ("representative
 * TaaSFlow engagements") and no source against any individual number.
 *
 * The platform's own records hold one confirmed hire, with a start date of
 * 25 September 2026. The Calibration desk states that only 9 scored candidates
 * have any downstream outcome recorded, and the Timing panel reports "Sample
 * too small — 2 completed". Several of these figures may well come from
 * recruiting delivered before this platform existed; that is precisely the
 * issue, because nothing on the page said so (audit 1 Sep, F23).
 *
 * The same domain's Trust Center runs the opposite standard — "Security and
 * privacy, stated only where we can prove it. Every claim here traces to the
 * platform, an internal control, or a published policy" — and carries a "What
 * we do not claim" section. Two public pages, two standards of evidence.
 *
 * So provenance is REQUIRED here, not optional, and a figure with no recorded
 * provenance does not render. That makes the rule structural rather than a
 * convention someone has to remember: the only way to publish a number is to
 * say where it came from.
 *
 * Filling these in is an owner call — the source of each figure is business
 * knowledge, not something derivable from this repository. Anything left
 * empty is simply not published until it is written.
 */

export type CaseStudyMetric = {
  /** Icon name resolved by the page; kept out of this config so it stays data. */
  iconKey: "users" | "globe" | "clock" | "trending" | "shield" | "handshake";
  value: string;
  label: string;
  /**
   * Where this number comes from, in the reader's own terms.
   *
   * Rendered beneath the figure. An empty string means "not yet attributed",
   * and the metric is withheld rather than published unsourced.
   */
  provenance: string;
};

/**
 * Written provenance, or an empty string.
 *
 * OWNER ACTION — each empty line below is a figure currently withheld from the
 * public page. To publish it, write where the number comes from. Examples of
 * the shape: "Across 11 years of recruiting delivery, including engagements
 * predating this platform", or "TaaSFlow platform records, 12 months to
 * 1 Sep 2026".
 *
 * A note on 12-month retention specifically: it is the one figure that cannot
 * be sourced to this platform under any framing, because the only confirmed
 * hire has a future start date. If it comes from prior recruiting delivery,
 * say so and it publishes; if it does not have a source, it should not carry
 * a provenance line invented to satisfy this field.
 */
export const CASE_STUDY_METRICS: CaseStudyMetric[] = [
  {
    iconKey: "users",
    value: "175+",
    label: "Positions delivered",
    provenance: "",
  },
  {
    iconKey: "globe",
    value: "18",
    label: "Cities engaged",
    provenance: "",
  },
  {
    iconKey: "clock",
    value: "7d",
    label: "Median time to shortlist",
    provenance: "",
  },
  {
    iconKey: "trending",
    value: "9.1/10",
    label: "Client shortlist rating",
    provenance: "",
  },
  {
    iconKey: "shield",
    value: "92%",
    label: "12-month retention",
    provenance: "",
  },
  {
    iconKey: "handshake",
    value: "86%",
    label: "Offer acceptance",
    provenance: "",
  },
];

/** The figures that may be published: exactly those with a recorded source. */
export function publishableMetrics(
  metrics: readonly CaseStudyMetric[] = CASE_STUDY_METRICS,
): CaseStudyMetric[] {
  return metrics.filter((m) => m.provenance.trim().length > 0);
}

/**
 * Placeholders that would satisfy the field without saying anything.
 *
 * A provenance line exists so a reader can check the number. "Internal data"
 * and "various sources" do not let anyone check anything, and would turn this
 * gate into paperwork.
 */
export const EMPTY_PROVENANCE_PHRASES = [
  "internal data",
  "various sources",
  "proprietary data",
  "n/a",
  "tbd",
  "to be confirmed",
  "see above",
  "representative data",
];
