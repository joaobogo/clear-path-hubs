import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Link, useSearch } from "@tanstack/react-router";
import { Printer, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { RequirementRow } from "@/lib/client-fit-presentation";


const STATUS_META: Record<
  RequirementRow["status"],
  { label: string; icon: string; className: string }
> = {
  met: { label: "Met", icon: "✓", className: "text-success dark:text-success" },
  partial: { label: "Partial", icon: "◐", className: "text-warning-foreground dark:text-warning-foreground" },
  not_evidenced: { label: "Not evidenced", icon: "○", className: "text-muted-foreground" },
  contradicted: { label: "Contradicted", icon: "✕", className: "text-destructive dark:text-destructive" },
  not_applicable: { label: "N/A", icon: "—", className: "text-muted-foreground" },
};

/**
 * Multi-axis observations WITHOUT declaring a single "winner".
 * Comparison cards ship one line per axis where candidates differ, and
 * deliberately avoid ranking by numerical score. Ranking questions are
 * left to the human reviewer.
 */
function buildObservations(cands: ClientCandidateDTO[]): string[] {
  if (cands.length < 2) return [];
  const notes: string[] = [];

  const cover = [...cands].sort((a, b) => b.coverage.must_met - a.coverage.must_met);
  if (cover[0].coverage.must_met !== cover[cover.length - 1].coverage.must_met) {
    notes.push(
      `Requirement coverage differs — ${cover[0].candidate.display_name} has the most must-haves evidenced (${cover[0].coverage.must_met}/${cover[0].coverage.must_total}).`,
    );
  }

  const exp = [...cands]
    .filter((c) => c.candidate.years_experience != null)
    .sort((a, b) => (b.candidate.years_experience ?? 0) - (a.candidate.years_experience ?? 0));
  if (exp.length >= 2 && exp[0].candidate.years_experience !== exp[exp.length - 1].candidate.years_experience) {
    notes.push(
      `Experience depth differs — ${exp[0].candidate.display_name} reports the most years of experience (${exp[0].candidate.years_experience}+).`,
    );
  }

  const concerns = cands.map((c) => ({ n: c.candidate.display_name, k: c.concerns.length }));
  const maxConcerns = Math.max(...concerns.map((x) => x.k));
  const minConcerns = Math.min(...concerns.map((x) => x.k));
  if (maxConcerns !== minConcerns) {
    const most = concerns.find((x) => x.k === maxConcerns)!;
    notes.push(
      `Validation load differs — ${most.n} has ${most.k} area${most.k === 1 ? "" : "s"} to validate before decision.`,
    );
  }

  notes.push(
    "Use these observations as inputs, not conclusions — final selection should reflect team fit, interview signal, and business context, not raw score.",
  );

  return notes;
}

export function CompareTray({
  selected,
  onClear,
  onOpen,
  disabledReason,
}: {
  selected: ClientCandidateDTO[];
  onClear: () => void;
  onOpen: () => void;
  disabledReason?: string | null;
}) {
  if (selected.length === 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-xl border bg-card shadow-lg px-4 py-3 flex items-center gap-3 max-w-[calc(100vw-2rem)]">
      <div className="text-sm">
        <span className="font-medium">{selected.length} selected</span>
        <span className="hidden sm:inline text-muted-foreground ml-2">
          {selected.map((c) => c.candidate.display_name).join(", ")}
        </span>
      </div>
      {disabledReason && (
        <span className="text-xs text-warning-foreground dark:text-warning-foreground">{disabledReason}</span>
      )}
      <Button size="sm" onClick={onOpen} disabled={selected.length < 2 || !!disabledReason}>
        Compare
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

export function CompareSheet({
  open,
  onOpenChange,
  candidates,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidates: ClientCandidateDTO[];
}) {
  const search = useSearch({ strict: false }) as { org?: string };
  const [diffOnly, setDiffOnly] = useState(false);

  // Guard: never render a comparison if candidates span multiple positions.
  const positionIds = new Set(candidates.map((c) => c.position?.id).filter(Boolean));
  const positionSafe = positionIds.size <= 1;

  // Union of requirements across selected candidates (same position → same rows).
  const rowsUnion = useMemo(() => {
    const map = new Map<string, RequirementRow>();
    for (const c of candidates) {
      for (const r of c.requirement_rows) {
        const key = `${r.importance}:${r.label.toLowerCase()}`;
        if (!map.has(key)) map.set(key, r);
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.importance !== b.importance) return a.importance === "must_have" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    return arr;
  }, [candidates]);

  const observations = buildObservations(candidates);
  const cols = Math.max(1, candidates.length);
  const positionTitle = candidates[0]?.position?.title;

  // Helper: are values across candidates identical? (for "differences only")
  const allSame = (vals: (string | number | null | undefined)[]) => {
    const first = vals[0];
    return vals.every((v) => (v ?? "") === (first ?? ""));
  };

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("compare", candidates.map((c) => c.match_id).join(","));
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("Share link copied", { description: "Same-role view, preserves context." });
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handlePrint = () => window.print();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto print:!max-w-none print:!w-full">
        <SheetHeader>
          <SheetTitle>Candidate comparison</SheetTitle>
        </SheetHeader>


        {!positionSafe ? (
          <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
            Comparison is only available for candidates on the same position.
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-xs text-muted-foreground">
                {positionTitle && (
                  <>Position: <span className="font-medium text-foreground">{positionTitle}</span> · {candidates.length} candidates</>
                )}
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={diffOnly}
                    onChange={(e) => setDiffOnly(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-input"
                  />
                  Show only differences
                </label>
                <Button size="sm" variant="outline" onClick={handleShare}>
                  <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
                </Button>
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Export PDF
                </Button>
              </div>
            </div>


            {/* Visual ranking bands — relative strength per axis, not a single winner. */}
            <RelativeStrengthBoard candidates={candidates} />

            {observations.length > 0 && (
              <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Observations
                </div>
                {observations.map((o, i) => (
                  <p key={i} className="text-foreground/90">
                    {o}
                  </p>
                ))}
              </div>
            )}

            {/* Headers */}
            <div
              className="mt-4 grid gap-3 sticky top-0 bg-background/95 backdrop-blur py-3 border-b z-10"
              style={{ gridTemplateColumns: `160px repeat(${cols}, minmax(0, 1fr))` }}
            >
              <div className="text-xs font-medium text-muted-foreground">Requirement</div>
              {candidates.map((c) => (
                <div key={c.match_id} className="min-w-0">
                  <div className="font-semibold truncate">{c.candidate.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.candidate.headline ?? c.position?.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-semibold tabular-nums">
                      {c.score == null ? "—" : c.score.toFixed(0)}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.fit.headline}</span>
                  </div>
                  <Link
                    to="/client/candidates/$id"
                    params={{ id: c.match_id }}
                    search={search.org ? { org: search.org } : undefined}
                    className="text-xs text-primary hover:underline"
                  >
                    Open profile →
                  </Link>
                </div>
              ))}
            </div>

            {/* Fit recommendation row */}
            <ComparisonRow
              label="Recommendation"
              cols={cols}
              hide={diffOnly && allSame(candidates.map((c) => c.fit.recommendation))}
            >
              {candidates.map((c) => (
                <div key={c.match_id} className="text-xs text-foreground/90">
                  {c.fit.recommendation}
                </div>
              ))}
            </ComparisonRow>

            {/* Stage */}
            <ComparisonRow
              label="Stage"
              cols={cols}
              hide={diffOnly && allSame(candidates.map((c) => c.stage))}
            >
              {candidates.map((c) => (
                <div key={c.match_id} className="text-xs capitalize">
                  {String(c.stage).replace(/_/g, " ")}
                </div>
              ))}
            </ComparisonRow>

            {/* Availability */}
            <ComparisonRow
              label="Availability"
              cols={cols}
              hide={diffOnly && allSame(candidates.map((c) => c.candidate.availability ?? ""))}
            >
              {candidates.map((c) => (
                <div key={c.match_id} className="text-xs">
                  {c.candidate.availability || (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </div>
              ))}
            </ComparisonRow>

            {/* Logistics — location + timezone + work authorization */}
            <ComparisonRow
              label="Logistics"
              cols={cols}
              hide={
                diffOnly &&
                allSame(
                  candidates.map(
                    (c) =>
                      `${c.candidate.location ?? ""}|${c.candidate.timezone ?? ""}|${c.work_authorization ?? ""}`,
                  ),
                )
              }
            >
              {candidates.map((c) => (
                <div key={c.match_id} className="text-xs">
                  <div>{c.candidate.location ?? <span className="text-muted-foreground">Location N/A</span>}</div>
                  {c.candidate.timezone && (
                    <div className="text-muted-foreground">TZ {c.candidate.timezone}</div>
                  )}
                  <div className="text-muted-foreground">
                    Auth: {c.work_authorization ?? "not confirmed"}
                  </div>
                </div>
              ))}
            </ComparisonRow>

            {/* Compensation alignment */}
            <ComparisonRow
              label="Compensation"
              cols={cols}
              hide={
                diffOnly &&
                allSame(
                  candidates.map(
                    (c) =>
                      `${c.compensation_alignment.verdict}|${c.compensation_alignment.candidate_expectation ?? ""}`,
                  ),
                )
              }
            >
              {candidates.map((c) => {
                const comp = c.compensation_alignment;
                const tone: Record<typeof comp.verdict, string> = {
                  aligned: "taas-bg-success-soft taas-fg-success",
                  over: "taas-bg-warning-soft taas-fg-warning",
                  under: "taas-bg-info-soft taas-fg-info",
                  unknown: "taas-bg-neutral-soft taas-fg-neutral",
                };
                const labels: Record<typeof comp.verdict, string> = {
                  aligned: "In range",
                  over: "Above range",
                  under: "Below range",
                  unknown: "Not confirmed",
                };
                return (
                  <div key={c.match_id} className="text-xs space-y-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone[comp.verdict]}`}>
                      {labels[comp.verdict]}
                    </span>
                    <div>{comp.candidate_expectation ?? <span className="text-muted-foreground">Not shared</span>}</div>
                    {comp.role_range && (
                      <div className="text-muted-foreground">Role: {comp.role_range}</div>
                    )}
                  </div>
                );
              })}
            </ComparisonRow>

            {/* Experience */}
            <ComparisonRow
              label="Experience"
              cols={cols}
              hide={diffOnly && allSame(candidates.map((c) => c.candidate.years_experience ?? -1))}
            >
              {candidates.map((c) => (
                <div key={c.match_id} className="text-xs">
                  {c.candidate.years_experience != null ? (
                    <span>{c.candidate.years_experience}+ yrs</span>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                  {c.candidate.current_role && (
                    <div className="text-muted-foreground truncate">
                      {c.candidate.current_role}
                      {c.candidate.current_company ? ` · ${c.candidate.current_company}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </ComparisonRow>

            {/* Coverage summary */}
            <ComparisonRow
              label="Must-have coverage"
              cols={cols}
              hide={diffOnly && allSame(candidates.map((c) => `${c.coverage.must_met}/${c.coverage.must_total}`))}
            >
              {candidates.map((c) => (
                <div key={c.match_id} className="text-xs">
                  <span className="font-medium">
                    {c.coverage.must_met}/{c.coverage.must_total}
                  </span>
                  {c.coverage.must_partial > 0 && (
                    <span className="text-muted-foreground"> · {c.coverage.must_partial} partial</span>
                  )}
                </div>
              ))}
            </ComparisonRow>


            {/* Strengths */}
            <ComparisonRow label="Strengths" cols={cols}>
              {candidates.map((c) => (
                <ul key={c.match_id} className="text-xs list-disc pl-4 space-y-0.5">
                  {c.strengths.slice(0, 4).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                  {c.strengths.length === 0 && (
                    <li className="list-none text-muted-foreground">None recorded.</li>
                  )}
                </ul>
              ))}
            </ComparisonRow>

            {/* Concerns / validation areas */}
            <ComparisonRow label="Concerns" cols={cols}>
              {candidates.map((c) => (
                <ul key={c.match_id} className="text-xs list-disc pl-4 space-y-0.5">
                  {c.concerns.slice(0, 4).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                  {c.concerns.length === 0 && (
                    <li className="list-none text-muted-foreground">None flagged.</li>
                  )}
                </ul>
              ))}
            </ComparisonRow>

            {/* Skills */}
            <ComparisonRow label="Skills" cols={cols}>
              {candidates.map((c) => (
                <div key={c.match_id} className="text-xs">
                  {c.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {c.skills.slice(0, 12).map((s, i) => (
                        <span key={i} className="rounded bg-muted px-1.5 py-0.5">
                          {s}
                        </span>
                      ))}
                      {c.skills.length > 12 && (
                        <span className="text-muted-foreground">+{c.skills.length - 12}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )}
                </div>
              ))}
            </ComparisonRow>

            {/* Education */}
            <ComparisonRow label="Education" cols={cols}>
              {candidates.map((c) => (
                <ul key={c.match_id} className="text-xs space-y-1">
                  {c.education.slice(0, 3).map((e, i) => (
                    <li key={i}>
                      <div className="font-medium">{e.degree ?? "Not specified"}</div>
                      {e.institution && (
                        <div className="text-muted-foreground truncate">{e.institution}</div>
                      )}
                    </li>
                  ))}
                  {c.education.length === 0 && (
                    <li className="text-muted-foreground">Not provided</li>
                  )}
                </ul>
              ))}
            </ComparisonRow>

            {/* Requirement matrix */}
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Requirement matrix
              </div>
              {rowsUnion.length === 0 && (
                <div className="text-sm text-muted-foreground py-4">
                  No structured requirements available.
                </div>
              )}
              {rowsUnion.map((r) => (
                <div
                  key={r.id + r.label}
                  className="grid gap-3 py-2 border-b text-sm"
                  style={{ gridTemplateColumns: `160px repeat(${cols}, minmax(0, 1fr))` }}
                >
                  <div className="min-w-0">
                    <div className="truncate">{r.label}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {r.importance === "must_have" ? "Must-have" : "Preferred"}
                    </div>
                  </div>
                  {candidates.map((c) => {
                    const cell =
                      c.requirement_rows.find(
                        (x) => x.label.toLowerCase() === r.label.toLowerCase(),
                      ) ?? null;
                    const status = cell?.status ?? "not_evidenced";
                    const meta = STATUS_META[status];
                    return (
                      <div key={c.match_id} className="min-w-0">
                        <div className={`text-sm font-medium ${meta.className}`}>
                          <span aria-hidden className="mr-1">
                            {meta.icon}
                          </span>
                          {meta.label}
                        </div>
                        {cell?.explanation && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {cell.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Interview focus */}
            <div className="mt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Suggested interview focus
              </div>
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `160px repeat(${cols}, minmax(0, 1fr))` }}
              >
                <div />
                {candidates.map((c) => (
                  <ul key={c.match_id} className="text-xs space-y-1 list-disc pl-4">
                    {c.interview_guide.slice(0, 3).map((q, i) => (
                      <li key={i}>{q.question}</li>
                    ))}
                    {c.interview_guide.length === 0 && (
                      <li className="list-none text-muted-foreground">No suggestions available.</li>
                    )}
                  </ul>
                ))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ComparisonRow({
  label,
  cols,
  hide = false,
  children,
}: {
  label: string;
  cols: number;
  hide?: boolean;
  children: React.ReactNode;
}) {
  if (hide) return null;
  return (
    <div
      className="grid gap-3 py-2 border-b"
      style={{ gridTemplateColumns: `160px repeat(${cols}, minmax(0, 1fr))` }}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}


/**
 * Visual ranking board — shows relative strength per axis using dots (●○○).
 * Never picks a single winner; every axis is independent, and score is only
 * one axis among many.
 */
function RelativeStrengthBoard({ candidates }: { candidates: ClientCandidateDTO[] }) {
  if (candidates.length < 2) return null;

  type Axis = { key: string; label: string; values: number[]; format?: (n: number) => string };
  const axes: Axis[] = [
    {
      key: "fit",
      label: "Fit score",
      values: candidates.map((c) => c.score ?? 0),
      format: (n) => (n ? n.toFixed(0) : "—"),
    },
    {
      key: "coverage",
      label: "Must-haves met",
      values: candidates.map((c) =>
        c.coverage.must_total ? c.coverage.must_met / c.coverage.must_total : 0,
      ),
      format: (n) => `${Math.round(n * 100)}%`,
    },
    {
      key: "experience",
      label: "Experience",
      values: candidates.map((c) => c.candidate.years_experience ?? 0),
      format: (n) => (n ? `${n}+ yrs` : "—"),
    },
    {
      key: "strengths",
      label: "Verified strengths",
      values: candidates.map((c) => c.strengths.length),
      format: (n) => `${n}`,
    },
    {
      key: "validation",
      label: "Areas to validate",
      values: candidates.map((c) => -c.concerns.length), // inverse: fewer concerns = stronger
      format: (n) => `${Math.abs(n)}`,
    },
  ];

  return (
    <div className="mt-4 rounded-xl border bg-gradient-to-br from-primary/[0.03] to-transparent p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Relative strength — axis by axis
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          ● Strongest · ◐ Mid · ○ Weakest
        </div>
      </div>
      <div className="space-y-2.5">
        {axes.map((axis) => {
          const max = Math.max(...axis.values);
          const min = Math.min(...axis.values);
          const span = max - min;
          return (
            <div key={axis.key} className="grid gap-3 sm:grid-cols-[9rem_1fr] items-center">
              <div className="text-xs font-medium text-foreground/80">{axis.label}</div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${candidates.length}, minmax(0, 1fr))` }}>
                {candidates.map((c, i) => {
                  const v = axis.values[i];
                  const rel = span === 0 ? 0.5 : (v - min) / span;
                  const dot = rel > 0.66 ? "●" : rel > 0.33 ? "◐" : "○";
                  const cls =
                    rel > 0.66
                      ? "text-success"
                      : rel > 0.33
                        ? "text-warning-foreground dark:text-warning-foreground"
                        : "text-muted-foreground";
                  return (
                    <div key={c.match_id} className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5">
                      <span className={`text-lg leading-none ${cls}`} aria-hidden>
                        {dot}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[11px] text-muted-foreground">
                          {c.candidate.display_name}
                        </div>
                        <div className="text-xs font-semibold tabular-nums">
                          {axis.format ? axis.format(v) : String(v)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Ranking is per axis. No single candidate is the winner across all dimensions —
        weigh these signals against your team fit and interview evidence.
      </p>
    </div>
  );
}
