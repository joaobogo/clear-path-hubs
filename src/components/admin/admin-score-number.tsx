/**
 * The ONE way a numeric score is allowed to appear.
 *
 * Numbers are staff-only, and a bare number is not interpretable: it needs the
 * confidence behind it and the rubric version it was computed against. This
 * component keeps those three facts together so no admin surface can show a
 * number on its own. Employer surfaces must use `CandidateScoreBadge` instead.
 */
import { Badge } from "@/components/ui/badge";
import { toFitPresentation } from "@/lib/client-fit-presentation";
import { publishedScore, publishedScoreDisplay } from "@/lib/scoring/published-score";

type RunLike = {
  score?: number | null;
  /** Human-reviewed figure; when present it IS the published score. */
  final_score?: number | string | null;
  fit_band?: string | null;
  confidence?: number | null;
  /** 0-100: how much of the rubric the run's evidence could actually decide. */
  evidence_confidence?: number | null;
  fit_label?: string | null;
  engine_version?: string | null;
  rubric_version_id?: string | null;
  rubric_versions?: { label?: string | null; version_number?: number | null } | null;
  /** Flat column form, selected by surfaces that do not join `rubric_versions`. */
  rubric_version_number?: number | null;
};

/**
 * Recruiter-readable wording. A recruiter should not have to decode "rubric",
 * "engine version" or a bare confidence decimal — each label says what the fact
 * means for their decision.
 */
/**
 * The criteria version behind a run, wherever the caller's row carries it.
 *
 * Surfaces load runs differently: some select the flat `rubric_version_number`
 * column, others join `rubric_versions`. Each surface reading only its own
 * shape is why one chip said "criteria set not recorded" beside a sentence
 * reading "scored against criteria version 1" on the same screen (audit #4,
 * M3). Both shapes resolve here, so every surface answers identically.
 */
export function rubricVersionNumber(run: RunLike | null | undefined): number | null {
  const joined = run?.rubric_versions?.version_number;
  if (joined != null) return Number(joined);
  const flat = (run as { rubric_version_number?: number | null } | null | undefined)
    ?.rubric_version_number;
  return flat != null ? Number(flat) : null;
}

export function rubricVersionLabel(run: RunLike | null | undefined): string {
  const version = rubricVersionNumber(run);
  if (version != null) {
    // The joined label is a machine slug ("auto-v1"); interpolating it produced
    // "scored against auto-v1 v1". The version number is the human fact.
    return `scored against criteria version ${version}`;
  }
  // Never a truncated UUID in prose — "criteria set 9dad7cb4" reads as
  // gibberish and leaks an internal identifier (S-21).
  return run?.rubric_version_id
    ? "scored against an earlier criteria version"
    : "criteria set not recorded";
}

export function engineVersionLabel(run: RunLike | null | undefined): string {
  const v = run?.engine_version;
  if (!v) return "scoring method unknown";
  const short = v.replace(/^taasflow-scoring-/, "");
  return `scoring method ${short}`;
}

export function confidenceLabel(run: RunLike | null | undefined): string {
  // Product copy, not debug output — "how complete the data was: 97%" read
  // as a colon-prefixed log fragment on every staff score display (S-21).
  const overall =
    run?.confidence == null
      ? "data completeness not recorded"
      : `data completeness ${Math.round(Number(run.confidence) * 100)}%`;
  // Both facts travel together: how complete the source data was, and how much
  // of the role's criteria the evidence could actually settle.
  //
  // Named for what it measures, not "evidence coverage". Three figures on the
  // evidence record used that word for three different denominators — this
  // run-level share, "3 of 7 must-have criteria fully evidenced", and
  // "8 requirements · 7 with verified quotes" — and a reader had no way to
  // tell them apart (audit 1 Sep, F21). This one is a stored share from the
  // run and carries no denominator we can print here, so at minimum it must
  // not borrow the wording of the counts that do.
  const evidence =
    run?.evidence_confidence == null
      ? null
      : `criteria settled by evidence ${Math.round(Number(run.evidence_confidence))}%`;
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
  const score = publishedScore(run);
  const display = publishedScoreDisplay(run);
  if (score == null || display == null) {
    return <span className={`text-sm text-muted-foreground ${className}`}>Not scored</span>;
  }
  const meta = `${confidenceLabel(run)} · ${rubricVersionLabel(run)} · ${engineVersionLabel(run)}`;
  const scoreLabel = `Score ${display}`;
  // The band comes from the ONE shared helper (score decides the band), never
  // from the stored engine label — otherwise 100 reads "strong fit" here and
  // "Exceptional" in the list.
  const bandLabel = toFitPresentation(run?.fit_label ?? null, score).headline;
  if (size === "lg") {
    return (
      <div className={`flex flex-wrap items-baseline gap-3 ${className}`} aria-label={scoreLabel}>
        <div className="text-5xl font-semibold tabular-nums" aria-hidden="true">{display}</div>
        <Badge variant="secondary">{bandLabel}</Badge>
        <span className="text-sm text-muted-foreground">{meta}</span>
      </div>
    );
  }
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-1.5 ${className}`} aria-label={scoreLabel}>
      <Badge variant="secondary" className="tabular-nums" aria-hidden="true">
        Score {display}
        <span className="ml-1 opacity-70">· {bandLabel}</span>
      </Badge>
      <span className="text-[11px] text-muted-foreground">{meta}</span>
    </span>
  );
}
