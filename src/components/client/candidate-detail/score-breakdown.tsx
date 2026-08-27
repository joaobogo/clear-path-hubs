import { memo, useState, type ReactNode } from "react";
import { CheckCircle2, Gauge, Info, ListChecks, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { buildScoreBreakdown, type BreakdownGroup, type BreakdownReason } from "@/lib/client/score-breakdown";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { RequirementRow } from "@/lib/client-fit-presentation";
import { SectionCard } from "./shared";
import { RequirementRowView } from "./evidence";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";
import { requirementBasis, formatBasis } from "@/lib/scoring/score-composition";

function CountChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "neutral";
}) {
  const cls = {
    success: "taas-bg-success-soft taas-fg-success",
    warning: "taas-bg-warning-soft taas-fg-warning",
    neutral: "taas-bg-neutral-soft taas-fg-neutral",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        cls,
      )}
    >
      <span className="tabular-nums">{value}</span>
      {label}
    </span>
  );
}

function ScoreComposition({ candidate }: { candidate: ClientCandidateDTO }) {
  const c = candidate.score_composition;
  if (!c || c.components.length === 0) return null;

  // Every percentage is recomputed from the requirement rows this page already
  // renders, so the composition can never quote a share the panels below
  // contradict. Half a point for a partly met requirement.
  const rows = candidate.requirement_rows ?? [];
  const bases = {
    must_have: requirementBasis(rows, "must_have"),
    preferred: requirementBasis(rows, "preferred"),
  } as const;
  const answers = candidate.screening_answers?.length ?? 0;

  const lines = c.components.map((k) => {
    const basis = k.key === "must_have" ? bases.must_have : k.key === "preferred" ? bases.preferred : null;
    const basisLabel = basis
      ? formatBasis(basis)
      : k.key === "screening_alignment" && answers > 0
        ? `from ${answers} screening ${answers === 1 ? "answer" : "answers"}`
        : null;
    return { ...k, basisLabel };
  });
  // Rounding happens once, on the total; the parts are whole points apportioned
  // to add up to it exactly. A Loom introduction adds its own line on top.
  const videoBonusPts = c.videoBonusPts ?? 0;
  const totalPts = c.grandTotalPts ?? c.totalPts + videoBonusPts;
  const reconciles = c.reconciles;

  return (
    <div className="mt-4 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">How the number is made up</h3>
      <TooltipProvider>
      {/* taas-stack-table: the three columns stack on a phone. */}
      <table className="taas-stack-table mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="font-medium">Component</th>
            <th className="font-medium">How it did</th>
            <th className="text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((k) => (
            <tr key={k.key} className="border-t align-baseline">
              <td data-label="Component" className="py-1.5 pr-2">{k.label}</td>
              <td data-label="How it did" className="py-1.5 pr-2 text-muted-foreground">
                {k.basisLabel ?? `${k.valuePct}%`}
              </td>
              <td data-label="Points" className="py-1.5 text-right tabular-nums">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="cursor-help underline decoration-dotted underline-offset-2"
                    >
                      {k.displayPts} pts
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {k.valuePct}%
                    {k.basisLabel ? ` (${k.basisLabel})` : ""} &times; {k.weightPct}% ={" "}
                    {k.displayPts} points
                  </TooltipContent>
                </Tooltip>
              </td>
            </tr>
          ))}
          {videoBonusPts > 0 && (
            <tr className="border-t align-baseline">
              <td data-label="Component" className="py-1.5 pr-2">Video introduction</td>
              <td data-label="How it did" className="py-1.5 pr-2 text-muted-foreground">
                Loom link on the application
              </td>
              <td data-label="Points" className="py-1.5 text-right tabular-nums">
                +{videoBonusPts} pts
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </TooltipProvider>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 border-t pt-2 text-sm font-medium">
        <span>Total</span>
        <span className="tabular-nums">
          {totalPts} points
        </span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Percentages are weighted counts of the requirements listed below: a fully
        evidenced requirement scores one point, a partly evidenced one half.
        {c.incomplete
          ? " One of the three weightings was not measured for this assessment, so the parts do not add up to the whole yet."
          : reconciles && c.displayedScore != null
            ? videoBonusPts > 0
              ? ` The four parts add up to ${totalPts}, the score shown above.`
              : ` The three parts add up to ${totalPts}, the score shown above.`
            : " The parts and the score shown disagree; the assessment is being re-checked."}
      </p>
    </div>
  );
}

/** A column of reasons, capped at three until the reader asks for the rest. */
function ReasonColumn({
  title,
  icon,
  bullet,
  reasons,
  emptyText,
  className,
}: {
  title: string;
  icon: ReactNode;
  bullet: ReactNode;
  reasons: BreakdownReason[];
  emptyText: string;
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? reasons : reasons.slice(0, 3);
  const hidden = reasons.length - visible.length;
  return (
    <div className={cn("rounded-lg border p-3", className)}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      {reasons.length > 0 ? (
        <>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {visible.map((r) => (
              <li key={r.id} className="flex gap-2">
                <span className="mt-0.5 shrink-0">{bullet}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mt-1 h-auto p-0 text-xs"
              onClick={() => setShowAll(true)}
            >
              Show all ({reasons.length})
            </Button>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

export const ScoreBreakdown = memo(function ScoreBreakdown({
  candidate,
  hideRequirementRows = false,
}: {
  candidate: ClientCandidateDTO;
  /** Set when the requirements are already listed once in the evidence panel. */
  hideRequirementRows?: boolean;
}) {
  const b = buildScoreBreakdown(candidate);
  if (b.empty) return null;

  const positives = b.reasons.filter((r: BreakdownReason) => r.tone === "positive");
  const watch = b.reasons.filter((r: BreakdownReason) => r.tone === "watch");

  return (
    <SectionCard
      title="Score breakdown"
      icon={<Gauge className="h-4 w-4" />}
      description="Why this candidate ranks where they do: the evidence behind each requirement, how each scoring criterion landed, and the reasons that moved the score."
    >
      {/* Conflicting-signal note lives with the score it qualifies (merged from
          the old "How this score was built" panel). */}
      {candidate.evaluation.contradiction && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Conflicting signals found
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {candidate.evaluation.contradiction} — flagged in evidence review before
            this candidate was delivered to your workspace.
          </p>
        </div>
      )}
      {/* The verdict (figure + band) is stated once, in the fit hero above.
          This row carries only the provenance of that figure. */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="text-xs text-muted-foreground">
          {b.bandFloor != null && b.bandCeiling != null && (
            <div className="tabular-nums">
              band range {b.bandFloor}–{b.bandCeiling}
            </div>
          )}
        </div>
        <div className="max-w-md text-right text-xs text-muted-foreground">
          {b.methodLabel && (
            <Badge variant="secondary" className="text-[10px]">
              {b.methodLabel}
            </Badge>
          )}
          {b.criteriaSummary && <p className="mt-1">{b.criteriaSummary}</p>}
          {b.scoredAt && (
            <p className="mt-0.5">
              Scored {formatDate((b.scoredAt))}
            </p>
          )}
        </div>
      </div>


      <ScoreComposition candidate={candidate} />

      {/* Must-have vs preferred evidence, kept apart because they weigh differently. */}
      <div className="mt-4 space-y-4">
        {b.groups.map((g: BreakdownGroup) => (
          <div key={g.kind}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {g.title}
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {g.met + g.partial} of {g.total} evidenced
              </span>
              {g.total > 0 && (
                <span className="flex flex-wrap gap-1.5">
                  <CountChip label="evidenced" value={g.met + g.partial} tone="success" />
                  {g.missing > 0 && (
                    <CountChip label="no evidence" value={g.missing} tone="neutral" />
                  )}
                </span>
              )}
            </div>
            {g.related > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Possible signals (not quoted): {g.related} of {g.total}
              </p>
            )}

            <p className="mt-1 text-xs text-muted-foreground">{g.takeaway}</p>
            {!hideRequirementRows && g.rows.length > 0 && (
              <ul className="mt-2 space-y-2">
                {g.rows.map((row: RequirementRow) => (
                  <RequirementRowView key={row.id} row={row} />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Scoring criteria with weights, only when the run stored them. */}
      {/* Scoring criteria removed - using honest factor-based explanation as per audit fix P-035. */}

      {/* The short answer: what lifted the score, and what holds it back. */}
      {(positives.length > 0 || watch.length > 0) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ReasonColumn
            title="What lifts the score"
            icon={<TrendingUp className="h-3.5 w-3.5" aria-hidden />}
            bullet={<CheckCircle2 className="h-3.5 w-3.5 taas-fg-success" aria-hidden />}
            reasons={positives}
            emptyText="No evidenced strengths recorded yet."
            className="border-success/30 bg-success/5"
          />
          <ReasonColumn
            title="What holds it back"
            icon={<TrendingDown className="h-3.5 w-3.5" aria-hidden />}
            bullet={<Info className="h-3.5 w-3.5" aria-hidden />}
            reasons={watch}
            emptyText="Nothing outstanding — every requirement carries evidence."
            className="bg-muted/30"
          />
        </div>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">
        Figures above are counts of quoted evidence from the background review. Re-scoring adds a new result; the old one is kept.
      </p>
    </SectionCard>
  );
});
