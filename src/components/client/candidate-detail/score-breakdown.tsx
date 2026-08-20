import { memo } from "react";
import { CheckCircle2, Gauge, Info, ListChecks, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildScoreBreakdown, type BreakdownGroup, type BreakdownReason } from "@/lib/client/score-breakdown";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { RequirementRow } from "@/lib/client-fit-presentation";
import { SectionCard } from "./shared";
import { RequirementRowView } from "./evidence";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";

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

export const ScoreBreakdown = memo(function ScoreBreakdown({
  candidate,
}: {
  candidate: ClientCandidateDTO;
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
      {/* Headline: the figure, its band and the method that produced it. */}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-end gap-3">
          <span className="text-3xl font-semibold tabular-nums leading-none">
            {b.score ?? "—"}
          </span>
          <div className="text-xs text-muted-foreground">
            <div className="text-sm font-medium text-foreground">{b.bandLabel}</div>
            {b.bandFloor != null && b.bandCeiling != null && (
              <div className="tabular-nums">
                band range {b.bandFloor}–{b.bandCeiling}
              </div>
            )}
          </div>
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
              Scored {formatDate(Date(b.scoredAt))}
            </p>
          )}
        </div>
      </div>

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
                  <CountChip label="quoted" value={g.met} tone="success" />
                  {g.partial > 0 && (
                    <CountChip label="related" value={g.partial} tone="warning" />
                  )}
                  {g.missing > 0 && (
                    <CountChip label="no evidence" value={g.missing} tone="neutral" />
                  )}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{g.takeaway}</p>
            {g.rows.length > 0 && (
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
          <div className="rounded-lg border border-success/30 bg-success/5 p-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              What lifts the score
            </h3>
            {positives.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {positives.map((r: BreakdownReason) => (
                  <li key={r.id} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 taas-fg-success" aria-hidden />
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No evidenced strengths recorded yet.
              </p>
            )}
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              What holds it back
            </h3>
            {watch.length > 0 ? (
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {watch.map((r: BreakdownReason) => (
                  <li key={r.id} className="flex gap-2">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing outstanding — every requirement carries evidence.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground">
        Figures above are counts of quoted evidence from the background review. A
        rescore appends a new run rather than editing this one.
      </p>
    </SectionCard>
  );
});
