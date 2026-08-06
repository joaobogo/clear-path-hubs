/**
 * Staff-facing score staleness chip.
 *
 * A fit number is a statement about facts at a moment in time. Wherever staff
 * see a score, they also see whether the profile or the brief has moved since —
 * silence here is how people trust a number that is no longer true.
 */
import { Clock, HelpCircle } from "lucide-react";
import { assessFreshness, type Freshness, type FreshnessInput } from "@/lib/scoring/score-freshness";
import { CALIBRATION_VERSION } from "@/lib/scoring/engine-calibration";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function freshnessFromRow(row: {
  scored_at?: string | null;
  scored_input_hash?: string | null;
  scored_engine_version?: string | null;
  profile_updated_at?: string | null;
  brief_updated_at?: string | null;
  scored_calibration_version?: string | null;
  criteria_updated_at?: string | null;
}): Freshness {
  return assessFreshness({
    ...(row as FreshnessInput),
    // Compared against what is running today: an older engine or calibration
    // means the same evidence would not produce the same number now.
    current_engine_version: ENGINE_VERSION,
    current_calibration_version: row.scored_calibration_version
      ? CALIBRATION_VERSION
      : null,
  });
}

/**
 * Renders nothing when the score is current — a chip on every row would be
 * noise, and "no chip" already means "assessed against today's facts".
 */
export function ScoreStalenessChip({
  freshness,
  className,
  compact = false,
}: {
  freshness: Freshness | null | undefined;
  className?: string;
  compact?: boolean;
}) {
  if (!freshness || freshness.state === "current") return null;
  const unknown = freshness.state === "unknown";
  const Icon = unknown ? HelpCircle : Clock;

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
              unknown
                ? "border-border bg-muted text-muted-foreground"
                : "taas-bg-warning-soft taas-tx-warning border-transparent",
              className,
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {compact ? null : <span>{unknown ? "Unverified age" : "Stale"}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-xs">
          <div className="font-semibold">
            {unknown ? "We cannot confirm when this was assessed" : "This score may be out of date"}
          </div>
          <div>{freshness.summary}</div>
          {freshness.reasons.length > 0 && (
            <ul className="list-disc pl-4">
              {freshness.reasons.map((r) => (
                <li key={r.code}>{r.label}</li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
