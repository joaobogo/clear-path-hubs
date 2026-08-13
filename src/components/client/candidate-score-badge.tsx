/**
 * Canonical candidate fit presentation for employer surfaces.
 *
 * Employer-facing surfaces show a FIT BAND and the evidence behind it, never a
 * numeric score — a raw 0-100 invites false precision and leaks internal engine
 * calibration. The band comes from the single normaliser in
 * `client-fit-presentation`, whose thresholds come from `scoring/bands.ts`.
 *
 * Numeric scores belong on admin/staff surfaces only, and only next to their
 * confidence and rubric version (see `ScoreProvenance` in the admin review).
 *
 * The unicorn marker survives, but it is no longer a bare 95 threshold: the
 * canonical rule in `isUnicornMatch()` requires a top-tier band AND a confirmed
 * hire, so the marker means outcome-verified fit.
 */
import { toFitPresentation, type FitPresentation } from "@/lib/client-fit-presentation";

type Props = {
  /** Fit score, 0-100. Shown to employers next to the band. */
  score: number | null | undefined;
  /** Raw engine/DB band label when available; takes precedence over score. */
  fitLabel?: string | null;
  /**
   * Requirements this assessment could evidence, out of those assessed. Shown
   * next to the band so the band is never a bare adjective. Omit when the
   * surface has no requirement rows loaded.
   */
  evidence?: { supported: number; total: number } | null;
  /**
   * True when the assessment's inputs changed after it was produced (role
   * requirements edited, screening questions changed, a newer CV attached).
   * The band still shows — hiding the candidate would be worse — but it is
   * marked as being re-checked so it is never presented as current.
   */
  rechecking?: boolean;
  /**
   * A specialist reviewed this assessment by hand. We state the fact only —
   * the reviewer's internal note never reaches an employer surface.
   */
  humanReviewed?: boolean;
  /**
   * True when this surface cannot supply the criteria and evidence behind the
   * assessment. The band still shows, marked "Evidence pending" — we never
   * print a supported-count that we cannot back with snippets.
   */
  evidencePending?: boolean;
  unicorn?: boolean;
  className?: string;
};


const ACCENT_CLASSES: Record<FitPresentation["accent"], string> = {
  emerald: "border-success/30 bg-success/10 text-success",
  sky: "border-info/30 bg-info/10 text-info",
  amber: "border-warning/30 bg-warning/10 text-warning-strong",
  slate: "border-border bg-muted text-muted-foreground",
  rose: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function UnicornBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ${className}`}
      title="Unicorn — fit score of 95 or higher"
    >
      <span aria-hidden>🦄</span>
      Unicorn
    </span>
  );
}

export function CandidateScoreBadge({
  score,
  fitLabel = null,
  evidence = null,
  rechecking = false,
  humanReviewed = false,
  evidencePending = false,
  unicorn = false,
  className = "",
}: Props) {
  const hasBand = fitLabel != null || score != null;
  if (!hasBand && !unicorn) return null;
  const fit = hasBand ? toFitPresentation(fitLabel, score) : null;
  const support =
    evidence && evidence.total > 0
      ? `${evidence.supported} of ${evidence.total} requirements evidenced`
      : null;
  const recheckNote =
    "This assessment is being re-checked because the role details or the candidate's CV changed after it was produced.";
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {score != null && (
        <span
          className={`inline-flex items-baseline gap-0.5 rounded-full border px-2 py-0.5 text-[12px] font-semibold tabular-nums ${fit ? ACCENT_CLASSES[fit.accent] : "border-border bg-muted text-muted-foreground"} ${rechecking ? "opacity-70" : ""}`}
          title="Fit score out of 100"
          aria-label={`Fit score ${Math.round(score)} out of 100`}
        >
          {Math.round(score)}
          <span className="text-[10px] font-normal opacity-70">/100</span>
        </span>
      )}
      {fit && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ACCENT_CLASSES[fit.accent]} ${rechecking ? "opacity-70" : ""}`}
          title={
            rechecking
              ? `${fit.recommendation} · ${recheckNote}`
              : support
                ? `${fit.recommendation} · ${support}`
                : fit.recommendation
          }
        >
          {fit.headline}
        </span>
      )}
      {rechecking && (
        <span
          className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          title={recheckNote}
        >
          Being re-checked
        </span>
      )}
      {evidencePending && !rechecking && (
        <span
          className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          title="The criteria and evidence behind this assessment are not available on this view yet."
        >
          Evidence pending
        </span>
      )}
      {support && !rechecking && !evidencePending && (
        <span className="text-[11px] text-muted-foreground" title={support}>
          {evidence!.supported}/{evidence!.total} evidenced
        </span>
      )}
      {humanReviewed && (
        <span
          className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          title="A TaaSFlow specialist reviewed this assessment by hand."
        >
          Specialist reviewed
        </span>
      )}
      {unicorn && <UnicornBadge />}
    </span>
  );
}

