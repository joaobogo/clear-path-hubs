/**
 * Canonical candidate fit presentation for employer surfaces.
 *
 * Employer-facing surfaces show a FIT BAND, never a numeric score — a raw
 * number invites false precision and leaks internal engine calibration.
 * The band comes from the single normaliser in `client-fit-presentation`.
 * The unicorn marker still flags a top-tier match or a confirmed hire.
 */
import { toFitPresentation, type FitPresentation } from "@/lib/client-fit-presentation";

type Props = {
  /** Internal numeric score — used only to derive the band, never displayed. */
  score: number | null | undefined;
  /** Raw engine/DB band label when available; takes precedence over score. */
  fitLabel?: string | null;
  unicorn?: boolean;
  className?: string;
};

const ACCENT_CLASSES: Record<FitPresentation["accent"], string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  slate: "border-border bg-muted text-muted-foreground",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export function UnicornBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary ${className}`}
      title="Unicorn — top-tier match or hired"
    >
      <span aria-hidden>🦄</span>
      Unicorn
    </span>
  );
}

export function CandidateScoreBadge({
  score,
  fitLabel = null,
  unicorn = false,
  className = "",
}: Props) {
  const hasBand = fitLabel != null || score != null;
  if (!hasBand && !unicorn) return null;
  const fit = hasBand ? toFitPresentation(fitLabel, score) : null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {fit && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ACCENT_CLASSES[fit.accent]}`}
          title={fit.recommendation}
        >
          {fit.headline}
        </span>
      )}
      {unicorn && <UnicornBadge />}
    </span>
  );
}
