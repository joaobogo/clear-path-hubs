/**
 * Staff-facing score staleness chip.
 *
 * A fit number is a statement about facts at a moment in time. Wherever staff
 * see a score, they also see whether the profile or the brief has moved since —
 * silence here is how people trust a number that is no longer true.
 */
import { Clock, HelpCircle } from "lucide-react";
import {
  assessFreshness,
  mergeStoredStaleness,
  type Freshness,
  type FreshnessInput,
  type StoredStaleness,
} from "@/lib/scoring/score-freshness";
import { CALIBRATION_VERSION } from "@/lib/scoring/engine-calibration";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Roles for which staleness is not a fact worth reporting. The Operations
 * "Stale scores" tile has always excluded these — a role nobody is hiring for
 * cannot have a stale deliverable, and the Recompute the chip offers can only
 * fail against an archived position. The list had no way to apply the same
 * rule, so it chipped rows the tile did not count (audit #4, item 48).
 */
const NOT_HIRING = new Set(["archived", "closed"]);

export function freshnessFromRow(
  row: {
    scored_at?: string | null;
    scored_input_hash?: string | null;
    scored_engine_version?: string | null;
    profile_updated_at?: string | null;
    brief_updated_at?: string | null;
    scored_calibration_version?: string | null;
    criteria_updated_at?: string | null;
    position_status?: string | null;
  } & StoredStaleness,
): Freshness {
  if (NOT_HIRING.has(String(row.position_status ?? ""))) {
    return {
      state: "current",
      reasons: [],
      summary: "This role is no longer being hired for.",
      offer_rescore: false,
    };
  }
  const inferred = assessFreshness({
    ...(row as FreshnessInput),
    // Compared against what is running today: an older engine or calibration
    // means the same evidence would not produce the same number now.
    current_engine_version: ENGINE_VERSION,
    current_calibration_version: row.scored_calibration_version
      ? CALIBRATION_VERSION
      : null,
  });
  // A recorded invalidation (rubric superseded, brief edited, newer CV) is a
  // fact, not an inference — it always shows.
  return mergeStoredStaleness(inferred, row);
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
            {/* Always worded: an icon-plus-colour-only indicator failed the
                accessibility spot-check (audit X-04/S-10) — dense rows get the
                short word, full rows the full label.

                The compact branch came FIRST in this ternary, so it said
                "Stale" for the unknown state too. On the candidates index —
                where the rows carry no staleness columns and every state is
                therefore unknown — that put a "Stale" chip on 22 rows while
                the Operations tile, reading the real columns, counted 7
                (audit #4, item 48). "We don't know" must not read as "it is
                out of date". */}
            <span>{unknown ? (compact ? "Unverified" : "Unverified age") : "Stale"}</span>
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
                <li key={r.code}>{r.detail ?? r.label}</li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
