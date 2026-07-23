import { Badge } from "@/components/ui/badge";
import { AlertTriangle, GitCommit, History, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";

// Evidence-first score explainability panel.
//
// Renders category breakdown, visible reasons, verbatim CV evidence,
// contradiction handling, override history, and "what changed" between the
// current run and the previous run. Consumes the same `runs`, `decisions`,
// `result`, and `evidence` payloads that the admin candidate detail loader
// already returns, so no extra queries are needed.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export function ScoreExplainability({
  runs,
  decisions,
  result,
  evidence,
}: {
  runs: Any[];
  decisions: Any[];
  result: Any;
  evidence: Any;
}) {
  const [current, prior] = runs ?? [];
  if (!current) return null;

  const cats = pickCategories(current, result);
  const reasons = collectReasons(result);
  const verdicts: Any[] = Array.isArray(
    evidence?.extracted?.insights?.requirement_verdicts,
  )
    ? evidence.extracted.insights.requirement_verdicts
    : [];
  const contradiction =
    current.contradiction_status && current.contradiction_status !== "none"
      ? current.contradiction_status
      : null;
  const overrides = (decisions ?? []).filter((d: Any) =>
    ["override", "approve", "reject", "request_recompute"].includes(d.decision_type),
  );

  return (
    <div className="space-y-4">
      {/* Model banner */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        <span>Evaluation model</span>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {current.engine_version ?? "engine"}
        </Badge>
        {current.input_hash && (
          <>
            <span>·</span>
            <span className="font-mono text-[10px]">
              hash {String(current.input_hash).slice(0, 12)}…
            </span>
          </>
        )}
        <span className="ml-auto">
          Immutable · each rescore appends a new versioned row.
        </span>
      </div>

      {/* Contradiction */}
      {contradiction && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Conflicting signals found
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {String(contradiction).replace(/_/g, " ")} — evidence review required
            before this candidate is validated for delivery.
          </p>
        </div>
      )}

      {/* Category breakdown */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold">Score breakdown</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Every category is grounded in verbatim evidence from the CV or
          screening answers. Categories with no evidence are marked partial or
          missed, never inferred.
        </p>
        <div className="mt-3 space-y-2">
          {cats.map((c) => (
            <CategoryBar key={c.label} label={c.label} value={c.value} weight={c.weight} />
          ))}
        </div>
      </div>

      {/* Visible reasons */}
      {(reasons.strengths.length > 0 || reasons.concerns.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <ReasonBlock
            tone="positive"
            title="Why this score is high"
            items={reasons.strengths}
          />
          <ReasonBlock
            tone="negative"
            title="What pulled the score down"
            items={reasons.concerns}
          />
        </div>
      )}

      {/* Evidence quotes */}
      {verdicts.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold">CV evidence</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Direct quotes from the candidate's CV backing each requirement.
          </p>
          <ul className="mt-3 space-y-2">
            {verdicts.slice(0, 10).map((v, i) => (
              <li
                key={i}
                className="rounded-md border bg-background/60 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium">
                    {v.required && <span className="text-destructive">* </span>}
                    {v.requirement_text}
                  </span>
                  <Badge
                    variant={
                      v.verdict === "met"
                        ? "default"
                        : v.verdict === "partial"
                          ? "secondary"
                          : v.verdict === "contradicted"
                            ? "destructive"
                            : "outline"
                    }
                    className="capitalize"
                  >
                    {v.verdict}
                  </Badge>
                </div>
                {v.cv_quote && (
                  <blockquote className="mt-2 border-l-2 border-primary/30 pl-3 text-xs italic text-muted-foreground">
                    “{v.cv_quote}”
                  </blockquote>
                )}
                {v.rationale && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {v.rationale}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What changed */}
      {prior && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <GitCommit className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">What changed since last evaluation</h3>
          </div>
          <ScoreDiff current={current} prior={prior} />
        </div>
      )}

      {/* Override history */}
      {overrides.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Reviewer override history</h3>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {overrides.map((d) => (
              <li key={d.id} className="rounded-md border bg-background/60 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium capitalize">
                    {String(d.decision_type).replace(/_/g, " ")}
                    {d.approved_score != null && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        set score → {Math.round(d.approved_score)}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </div>
                {d.reason && (
                  <p className="mt-1 text-xs text-muted-foreground">{d.reason}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function pickCategories(
  run: Any,
  result: Any,
): { label: string; value: number | null; weight?: number }[] {
  const cb = result?.category_breakdown ?? {};
  return [
    {
      label: "Must-have coverage",
      value: run.must_have_coverage ?? cb.must_have ?? null,
      weight: 0.5,
    },
    {
      label: "Preferred coverage",
      value: run.preferred_coverage ?? cb.preferred ?? null,
      weight: 0.3,
    },
    {
      label: "Screening alignment",
      value: cb.screening_alignment ?? null,
      weight: 0.2,
    },
  ];
}

function collectReasons(result: Any): {
  strengths: string[];
  concerns: string[];
} {
  return {
    strengths: (result?.strengths ?? []).filter((s: unknown) => typeof s === "string"),
    concerns: (result?.concerns ?? []).filter((s: unknown) => typeof s === "string"),
  };
}

function CategoryBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number | null;
  weight?: number;
}) {
  const pct = value == null ? null : Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">
          {label}
          {weight != null && (
            <span className="ml-2 text-muted-foreground">
              · weight {Math.round(weight * 100)}%
            </span>
          )}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {pct == null ? "—" : `${pct}%`}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary transition-all"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function ReasonBlock({
  tone,
  title,
  items,
}: {
  tone: "positive" | "negative";
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h4
        className={
          tone === "positive"
            ? "text-xs font-semibold uppercase tracking-wide text-success"
            : "text-xs font-semibold uppercase tracking-wide text-destructive"
        }
      >
        {title}
      </h4>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
        {items.length === 0 && (
          <li className="list-none text-muted-foreground">Nothing surfaced.</li>
        )}
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function ScoreDiff({ current, prior }: { current: Any; prior: Any }) {
  const cur = Math.round(current.score ?? 0);
  const pri = Math.round(prior.score ?? 0);
  const diff = cur - pri;
  const Icon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : GitCommit;
  const tone =
    diff > 0
      ? "text-success"
      : diff < 0
        ? "text-destructive"
        : "text-muted-foreground";
  const bandChanged = current.fit_label !== prior.fit_label;
  const contradictionChanged =
    current.contradiction_status !== prior.contradiction_status;

  return (
    <div className="mt-2 space-y-2 text-sm">
      <div className={`flex items-center gap-2 ${tone}`}>
        <Icon className="h-4 w-4" />
        <span className="font-medium">
          {pri} → {cur}
        </span>
        <span className="text-xs">
          ({diff > 0 ? "+" : ""}
          {diff} pts)
        </span>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>
          Fit band:{" "}
          <span className={bandChanged ? "text-foreground font-medium" : ""}>
            {String(prior.fit_label ?? "—").replace(/_/g, " ")} →{" "}
            {String(current.fit_label ?? "—").replace(/_/g, " ")}
          </span>
        </li>
        <li>
          Contradictions:{" "}
          <span className={contradictionChanged ? "text-foreground font-medium" : ""}>
            {String(prior.contradiction_status ?? "none").replace(/_/g, " ")} →{" "}
            {String(current.contradiction_status ?? "none").replace(/_/g, " ")}
          </span>
        </li>
        <li>
          Evaluated{" "}
          {prior.completed_at
            ? new Date(prior.completed_at).toLocaleString()
            : "—"}{" "}
          →{" "}
          {current.completed_at
            ? new Date(current.completed_at).toLocaleString()
            : "—"}
        </li>
        <li className="italic">
          Score runs are immutable — the previous evaluation is preserved for audit.
        </li>
      </ul>
    </div>
  );
}
