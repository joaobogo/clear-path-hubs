import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Link, useSearch } from "@tanstack/react-router";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import type { RequirementRow } from "@/lib/client-fit-presentation";

const STATUS_META: Record<
  RequirementRow["status"],
  { label: string; icon: string; className: string }
> = {
  met: { label: "Met", icon: "✓", className: "text-emerald-700 dark:text-emerald-400" },
  partial: { label: "Partial", icon: "◐", className: "text-amber-700 dark:text-amber-400" },
  not_evidenced: { label: "Not evidenced", icon: "○", className: "text-muted-foreground" },
  contradicted: { label: "Contradicted", icon: "✕", className: "text-rose-700 dark:text-rose-400" },
  not_applicable: { label: "N/A", icon: "—", className: "text-muted-foreground" },
};

function buildRecommendationSummary(cands: ClientCandidateDTO[]): string | null {
  if (cands.length < 2) return null;
  const byCoverage = [...cands].sort((a, b) => b.coverage.overall_pct - a.coverage.overall_pct);
  const byExperience = [...cands].sort(
    (a, b) => (b.candidate.years_experience ?? 0) - (a.candidate.years_experience ?? 0),
  );
  const strongest = byCoverage[0];
  const deepest = byExperience[0];
  if (strongest.match_id === deepest.match_id) {
    return `Based on approved evidence, ${strongest.candidate.display_name} has the strongest overall requirement coverage.`;
  }
  return `Based on approved evidence, ${strongest.candidate.display_name} has the strongest overall requirement coverage, while ${deepest.candidate.display_name} has deeper experience.`;
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
        <span className="text-xs text-amber-700 dark:text-amber-400">{disabledReason}</span>
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

  const summary = buildRecommendationSummary(candidates);
  const cols = Math.max(1, candidates.length);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Candidate comparison</SheetTitle>
        </SheetHeader>

        {summary && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm text-foreground/90">
            {summary}
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
        <ComparisonRow label="Recommendation" cols={cols}>
          {candidates.map((c) => (
            <div key={c.match_id} className="text-xs text-foreground/90">
              {c.fit.recommendation}
            </div>
          ))}
        </ComparisonRow>

        {/* Coverage summary */}
        <ComparisonRow label="Must-have coverage" cols={cols}>
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

        {/* Requirement matrix */}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Requirement matrix
          </div>
          {rowsUnion.length === 0 && (
            <div className="text-sm text-muted-foreground py-4">No structured requirements available.</div>
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
      </SheetContent>
    </Sheet>
  );
}

function ComparisonRow({
  label,
  cols,
  children,
}: {
  label: string;
  cols: number;
  children: React.ReactNode;
}) {
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
