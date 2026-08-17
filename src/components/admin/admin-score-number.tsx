/**
 * The ONE way a numeric score is allowed to appear.
 *
 * Numbers are staff-only, and a bare number is not interpretable: it needs the
 * confidence behind it and the rubric version it was computed against. This
 * component keeps those three facts together so no admin surface can show a
 * number on its own. Employer surfaces must use `CandidateScoreBadge` instead.
 */
import { Badge } from "@/components/ui/badge";

type RunLike = {
  score?: number | null;
  confidence?: number | null;
  /** 0-100: how much of the rubric the run's evidence could actually decide. */
  evidence_confidence?: number | null;
  fit_label?: string | null;
  engine_version?: string | null;
  rubric_version_id?: string | null;
  rubric_versions?: { label?: string | null; version_number?: number | null } | null;
};

export function rubricVersionLabel(run: RunLike | null | undefined): string {
  const rv = run?.rubric_versions ?? null;
  if (rv && (rv.label || rv.version_number != null)) {
    return `${rv.label ?? "rubric"} v${rv.version_number ?? "?"}`;
  }
  return run?.rubric_version_id ? `rubric ${run.rubric_version_id.slice(0, 8)}` : "rubric unlinked";
}

export function engineVersionLabel(run: RunLike | null | undefined): string {
  return run?.engine_version ?? "engine unknown";
}

export function confidenceLabel(run: RunLike | null | undefined): string {
  const overall =
    run?.confidence == null
      ? "confidence n/a"
      : `confidence ${Math.round(Number(run.confidence) * 100)}%`;
  // Both confidences travel together: overall confidence in the run, and how
  // much of the rubric its evidence actually decided.
  const evidence =
    run?.evidence_confidence == null
      ? null
      : `evidence ${Math.round(Number(run.evidence_confidence))}%`;
  return evidence ? `${overall} · ${evidence}` : overall;
}

/** Inline staff-only score: number + confidence + rubric version, always together. */
export function AdminScoreNumber({
  run,
  size = "sm",
  className = "",
}: {
  run: RunLike | null | undefined;
  size?: "sm" | "lg";
  className?: string;
}) {
  if (run?.score == null) {
    return <span className={`text-sm text-muted-foreground ${className}`}>Not scored</span>;
  }
  const meta = `${confidenceLabel(run)} · ${rubricVersionLabel(run)} · ${engineVersionLabel(run)}`;
  const scoreLabel = `Score ${Math.round(Number(run.score))}`;
  if (size === "lg") {
    return (
      <div className={`flex flex-wrap items-baseline gap-3 ${className}`} aria-label={scoreLabel}>
        <div className="text-5xl font-semibold tabular-nums" aria-hidden="true">{Math.round(Number(run.score))}</div>
        {run.fit_label && (
          <Badge variant="secondary">{String(run.fit_label).replace(/_/g, " ")}</Badge>
        )}
        <span className="text-sm text-muted-foreground">{meta}</span>
      </div>
    );
  }
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-1.5 ${className}`} aria-label={scoreLabel}>
      <Badge variant="secondary" className="tabular-nums" aria-hidden="true">
        Score {Math.round(Number(run.score))}
        {run.fit_label && (
          <span className="ml-1 opacity-70">· {String(run.fit_label).replace(/_/g, " ")}</span>
        )}
      </Badge>
      <span className="text-[11px] text-muted-foreground">{meta}</span>
    </span>
  );
}
