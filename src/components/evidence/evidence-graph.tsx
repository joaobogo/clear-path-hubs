import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CircleSlash,
  FileText,
  Quote,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  EVIDENCE_STATE_LABEL,
  EVIDENCE_STATE_MEANING,
  type EvidenceChainMeta,
  type EvidenceChainNode,
  type EvidenceState,
} from "@/lib/evidence/evidence-graph";

/**
 * Interactive Evidence Graph.
 *
 * Renders the chain requirement → evidence → source/quote → scoring rule →
 * score contribution → decision impact, for one selected requirement at a time.
 * Read-only: it never writes scores, weights or records.
 */

const STATE_TONE: Record<EvidenceState, string> = {
  verified: "border-success/40 bg-success/10 text-success",
  missing: "border-muted-foreground/30 bg-muted text-muted-foreground",
  conflicting: "border-destructive/40 bg-destructive/10 text-destructive",
  user_confirmed: "border-info/40 bg-info/10 text-info",
  system_interpretation: "border-warning/40 bg-warning/10 text-warning-foreground",
};

const STATE_ICON: Record<EvidenceState, typeof ShieldCheck> = {
  verified: ShieldCheck,
  missing: CircleSlash,
  conflicting: AlertTriangle,
  user_confirmed: UserCheck,
  system_interpretation: Sparkles,
};

export function EvidenceStateChip({
  state,
  className = "",
}: {
  state: EvidenceState;
  className?: string;
}) {
  const Icon = STATE_ICON[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATE_TONE[state]} ${className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {EVIDENCE_STATE_LABEL[state]}
    </span>
  );
}

export function EvidenceGraph({
  nodes,
  meta,
  variant = "full",
  representative = false,
  idPrefix = "evidence-graph",
  title = "Evidence graph",
  description,
}: {
  nodes: EvidenceChainNode[];
  meta: EvidenceChainMeta;
  variant?: "compact" | "full";
  representative?: boolean;
  idPrefix?: string;
  title?: string;
  description?: string;
}) {
  const [activeId, setActiveId] = useState<string>(nodes[0]?.id ?? "");
  const listRef = useRef<HTMLDivElement>(null);
  const active = useMemo(
    () => nodes.find((n) => n.id === activeId) ?? nodes[0],
    [nodes, activeId],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const i = nodes.findIndex((n) => n.id === (active?.id ?? ""));
      const last = nodes.length - 1;
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? last
            : e.key === "ArrowDown" || e.key === "ArrowRight"
              ? Math.min(last, i + 1)
              : Math.max(0, i - 1);
      const target = nodes[next];
      if (!target) return;
      setActiveId(target.id);
      const el = listRef.current?.querySelector<HTMLButtonElement>(
        `[data-node-id="${cssEscape(target.id)}"]`,
      );
      el?.focus();
    },
    [nodes, active],
  );

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No requirements have been evaluated yet, so there is no evidence chain to
        show. Run the scoring pipeline to build one.
      </div>
    );
  }

  return (
    <section
      className="rounded-xl border bg-card"
      aria-label={title}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            {description ??
              "Pick a requirement to follow it end to end: the evidence found, the source it came from, the rule the engine applied, the points it moved, and what that means for the decision."}
          </p>
        </div>
        {representative && (
          <span className="shrink-0 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Representative data
          </span>
        )}
      </header>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        <span>{meta.total} requirements</span>
        <span>{meta.verified} with verified quotes</span>
        <span>{meta.missing} with no evidence</span>
        <span>{meta.conflicting} conflicting</span>
        <span>{meta.userConfirmed} reviewer-confirmed</span>
        <span>{meta.interpretationOnly} interpretation only</span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* Requirement rail */}
        <div
          ref={listRef}
          role="tablist"
          aria-orientation="vertical"
          aria-label="Requirements"
          onKeyDown={onKeyDown}
          className="max-h-[26rem] overflow-y-auto border-b p-2 lg:max-h-none lg:border-b-0 lg:border-r"
        >
          {nodes.map((n) => {
            const selected = n.id === active?.id;
            return (
              <button
                key={n.id}
                type="button"
                role="tab"
                data-node-id={n.id}
                id={`${idPrefix}-tab-${slug(n.id)}`}
                aria-selected={selected}
                aria-controls={`${idPrefix}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(n.id)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  selected ? "bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium leading-snug">
                    {n.requirement}
                  </span>
                  <Badge
                    variant={n.required ? "default" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {n.importanceLabel}
                  </Badge>
                </span>
                <span className="mt-1.5 block">
                  <EvidenceStateChip state={n.evidenceState} />
                </span>
              </button>
            );
          })}
        </div>

        {/* Chain detail */}
        <div
          id={`${idPrefix}-panel`}
          role="tabpanel"
          aria-labelledby={active ? `${idPrefix}-tab-${slug(active.id)}` : undefined}
          tabIndex={0}
          className="min-w-0 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
        >
          {active && (
            <ol className="space-y-3">
              <Step index={1} label="Requirement">
                <p className="text-sm font-medium">{active.requirement}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {active.importanceLabel} · sits in the{" "}
                  {active.blockKey === "must_have" ? "must-have" : "preferred"} block,
                  worth {active.blockWeightPct}% of the score in total.
                  {active.matchedTerms.length > 0 && (
                    <> Matched terms: {active.matchedTerms.join(", ")}.</>
                  )}
                </p>
              </Step>

              <Step index={2} label="Candidate evidence">
                <div className="flex flex-wrap items-center gap-2">
                  <EvidenceStateChip state={active.evidenceState} />
                  <Badge variant="outline" className="capitalize text-[10px]">
                    status: {active.status}
                  </Badge>
                  {active.confidence != null && (
                    <span className="text-[11px] text-muted-foreground">
                      stored confidence {Math.round(active.confidence * 100)}%
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {EVIDENCE_STATE_MEANING[active.evidenceState]}
                </p>
                {active.confidence == null && variant === "full" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No confidence value is stored for this record, so none is shown.
                  </p>
                )}
              </Step>

              <Step index={3} label="Source and quote">
                {active.sources.length === 0 ? (
                  <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
                    No source passage exists for this requirement. Nothing is quoted,
                    paraphrased or assumed in its place.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {active.sources.map((s, i) => (
                      <li key={i} className="rounded-md border bg-background/60 p-3">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {s.kind === "screening" ? (
                            <FileText className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Quote className="h-3 w-3" aria-hidden="true" />
                          )}
                          <span>{s.kind}</span>
                          {s.location && (
                            <span className="font-mono normal-case">{s.location}</span>
                          )}
                        </div>
                        <blockquote className="mt-1.5 border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground">
                          {s.quote}
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                )}
                {active.interpretation && (
                  <div className="mt-2 rounded-md border border-warning/30 bg-warning/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-warning-foreground">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      System interpretation
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {active.interpretation}
                    </p>
                  </div>
                )}
                {variant === "full" && active.reviewer && (
                  <div className="mt-2 rounded-md border border-info/30 bg-info/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-info">
                      <UserCheck className="h-3 w-3" aria-hidden="true" />
                      Reviewer {active.reviewer.status}
                      {active.reviewer.at && (
                        <span className="font-normal normal-case text-muted-foreground">
                          · {new Date(active.reviewer.at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {active.reviewer.note && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {active.reviewer.note}
                      </p>
                    )}
                  </div>
                )}
              </Step>

              <Step index={4} label="Scoring rule">
                <p className="text-xs text-muted-foreground">{active.rule}</p>
                {variant === "full" && active.validationNeed && (
                  <p className="mt-1 text-xs text-warning-foreground">
                    Validation needed: {active.validationNeed}
                  </p>
                )}
              </Step>

              <Step index={5} label="Score contribution">
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-semibold tabular-nums">
                    {active.pointsEarned} of {active.pointsAvailable} pts
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">
                    credit {active.credit} inside the {active.blockWeightPct}% block
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted" aria-hidden="true">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{
                      width: `${
                        active.pointsAvailable > 0
                          ? Math.round((active.pointsEarned / active.pointsAvailable) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </Step>

              <Step index={6} label="Decision impact" last>
                <p className="text-sm">{active.decisionImpact}</p>
              </Step>
            </ol>
          )}
        </div>
      </div>

      <footer className="border-t px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
        Weights and credits shown here restate the rules the scoring engine already
        applied. This view reads records; it never recalculates or edits a score.
      </footer>
    </section>
  );
}

function Step({
  index,
  label,
  children,
  last = false,
}: {
  index: number;
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative pl-8">
      <span className="absolute left-0 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-[10px] font-semibold tabular-nums">
        {index}
      </span>
      {!last && (
        <span
          className="absolute left-[9px] top-6 h-[calc(100%-1rem)] w-px bg-border"
          aria-hidden="true"
        />
      )}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </li>
  );
}

const slug = (v: string) => v.replace(/[^a-zA-Z0-9_-]/g, "-");
const cssEscape = (v: string) => v.replace(/["\\]/g, "\\$&");
