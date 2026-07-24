/**
 * Candidate Status Block — the canonical hierarchy visualisation for the
 * five separated concepts. Used everywhere a candidate is presented so
 * eligibility, fit, confidence, recommendation and stage stop looking
 * like five equal chips.
 *
 * Hierarchy:
 *   1. Fit score + band            (dominant — large, coloured)
 *   2. Recommendation              (secondary — pill under the score)
 *   3. Eligibility                 (row 3, left) — muted unless it's a
 *                                   blocker or needs validation
 *   4. Confidence                  (row 3, right) — meter, always shown
 *   5. Stage                       (row 4 — operational lane badge)
 */

import { cn } from "@/lib/utils";
import {
  classifyScoreBand,
  displayScore,
  type ScoreBandDef,
} from "@/config/scoring-bands";
import {
  CONFIDENCE_LABELS,
  ELIGIBILITY_LABELS,
  ELIGIBILITY_TONE,
  RECOMMENDATION_LABELS,
  classifyConfidence,
  type EligibilityStatus,
  type RecommendationStatus,
} from "@/lib/scoring/status-taxonomy";

type Props = {
  fit_score: number | null | undefined;
  evidence_confidence: number | null | undefined;
  eligibility: EligibilityStatus;
  recommendation: RecommendationStatus;
  stage?: string | null;
  compact?: boolean;
  className?: string;
};

const ACCENT_BG: Record<ScoreBandDef["accent"], string> = {
  emerald: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-500/30",
  sky: "bg-sky-500/10 text-sky-700 border-sky-200 dark:text-sky-300 dark:border-sky-500/30",
  amber: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-500/30",
  slate: "bg-slate-500/10 text-slate-700 border-slate-200 dark:text-slate-300 dark:border-slate-500/30",
  rose: "bg-rose-500/10 text-rose-700 border-rose-200 dark:text-rose-300 dark:border-rose-500/30",
};

const ELIG_STYLE: Record<
  ReturnType<(typeof ELIGIBILITY_TONE)[keyof typeof ELIGIBILITY_TONE] extends never ? never : never> | string,
  string
> = {
  positive: "text-emerald-700 dark:text-emerald-300",
  neutral: "text-slate-700 dark:text-slate-300",
  cautious: "text-amber-700 dark:text-amber-300",
  blocked: "text-rose-700 dark:text-rose-300",
  muted: "text-muted-foreground",
};

const REC_STYLE: Record<RecommendationStatus, string> = {
  shortlist: "bg-emerald-600 text-white",
  review: "bg-sky-600 text-white",
  hold_for_validation: "bg-amber-600 text-white",
  pending: "bg-muted text-muted-foreground",
  do_not_recommend: "bg-slate-700 text-white",
};

export function CandidateStatusBlock({
  fit_score,
  evidence_confidence,
  eligibility,
  recommendation,
  stage,
  compact,
  className,
}: Props) {
  const band = classifyScoreBand(fit_score);
  const score = displayScore(fit_score);
  const confBand = classifyConfidence(evidence_confidence);
  const confPct =
    typeof evidence_confidence === "number" && Number.isFinite(evidence_confidence)
      ? Math.max(0, Math.min(100, evidence_confidence))
      : null;
  const eligTone = ELIGIBILITY_TONE[eligibility];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* 1 — Fit (dominant) */}
      <div className="flex items-baseline gap-3">
        <div
          className={cn(
            "inline-flex items-baseline gap-2 rounded-lg border px-3 py-1.5",
            ACCENT_BG[band.accent],
          )}
        >
          <span className={cn("font-semibold", compact ? "text-2xl" : "text-3xl")}>
            {score ?? "—"}
          </span>
          <span className="text-xs uppercase tracking-wide opacity-70">/ 100</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{band.label}</span>
          {/* 2 — Recommendation (secondary) */}
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              REC_STYLE[recommendation],
            )}
          >
            {RECOMMENDATION_LABELS[recommendation]}
          </span>
        </div>
      </div>

      {/* 3 — Eligibility + Confidence (peers, muted unless notable) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className={cn("inline-flex items-center gap-1.5", ELIG_STYLE[eligTone])}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          <span className="font-medium">Eligibility:</span>
          <span>{ELIGIBILITY_LABELS[eligibility]}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span className="font-medium">Evidence:</span>
          <span>{CONFIDENCE_LABELS[confBand]}</span>
          {confPct !== null && (
            <span className="ml-1 inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "h-full",
                  confBand === "high" && "bg-emerald-500",
                  confBand === "medium" && "bg-sky-500",
                  confBand === "low" && "bg-amber-500",
                  confBand === "insufficient" && "bg-slate-400",
                )}
                style={{ width: `${Math.max(4, confPct)}%` }}
                aria-label={`Evidence confidence ${Math.round(confPct)}%`}
              />
            </span>
          )}
        </span>
      </div>

      {/* 4 — Stage (operational lane) */}
      {stage && (
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Stage · <span className="text-foreground">{stage.replace(/_/g, " ")}</span>
        </div>
      )}
    </div>
  );
}
