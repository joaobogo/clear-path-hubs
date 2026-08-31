import { isUnicornScore } from "@/lib/scoring/score-counts";
import { publishedScoreDisplay } from "@/lib/scoring/published-score";

/**
 * Standout marker for candidates with a fit score of 95 or higher.
 * Renders a unicorn emoji with an accessible label and tooltip.
 */
export function UnicornMarker({
  unicorn,
  score,
  className = "",
}: {
  /** Explicit flag when already computed (e.g. ClientCandidateDTO.unicorn). */
  unicorn?: boolean;
  /** Raw score or run; marker shows when published score is >= 95. */
  score?: number | { score?: number | string | null; final_score?: number | string | null } | null;
  className?: string;
}) {
  let show = false;
  if (unicorn === true) {
    show = true;
  } else if (score != null && typeof score === "number") {
    show = isUnicornScore(score);
  } else if (score != null && typeof score === "object") {
    show = isUnicornScore(publishedScoreDisplay(score));
  }

  if (!show) return null;

  // `ml-1` so the marker never sits flush against the name it decorates:
  // lists rendered "Helena Carvalho🦄" (audit #7, A6-29). Callers that need
  // different spacing override it through `className`, which comes last.
  return (
    <span
      className={`ml-1 shrink-0 ${className}`}
      aria-label="Unicorn candidate"
      title="Unicorn candidate — 95+ fit score"
      role="img"
    >
      🦄
    </span>
  );
}
