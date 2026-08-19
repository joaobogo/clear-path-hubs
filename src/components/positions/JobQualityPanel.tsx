// Job-quality indicator: names the missing decision-critical information
// instead of showing an arbitrary completeness percentage.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getRequisitionQuality } from "@/lib/requisition.functions";
import { assessJobQuality } from "@/lib/requisition-schema";
import type { QualityGap, QualityInput } from "@/lib/requisition-schema";

const TONE: Record<string, string> = {
  not_scoreable: "border-destructive/40 bg-destructive/5",
  scoreable_with_gaps: "border-amber-500/40 bg-amber-500/5",
  decision_ready: "border-emerald-500/40 bg-emerald-500/5",
};

type EditTarget = { to: string; positionId: string };

function GapList({
  title,
  gaps,
  onJumpToStep,
  editTo,
}: {
  title: string;
  gaps: QualityGap[];
  onJumpToStep?: (step: number) => void;
  editTo?: EditTarget;
}) {
  if (gaps.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {gaps.map((g) => (
          <li key={g.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{g.label}</span>
              <span className="block text-xs text-muted-foreground">{g.why}</span>
            </span>
            {g.step && onJumpToStep ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onJumpToStep(g.step!)}>
                Fix in step {g.step}
              </Button>
            ) : g.step && editTo ? (
              <Button asChild size="sm" variant="ghost">
                <Link
                  to={editTo.to}
                  params={{ id: editTo.positionId }}
                  search={{ step: g.step } as never}
                >
                  Fix this
                </Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function JobQualityPanel({
  positionId,
  onJumpToStep,
  compact,
  editTo,
  draft,
}: {
  positionId: string;
  onJumpToStep?: (step: number) => void;
  compact?: boolean;
  editTo?: EditTarget;
  /**
   * Unsaved draft values from an open editor. When present, the checklist is
   * recomputed from the same pure assessment against the draft, so a field the
   * user just set clears its entry without waiting for a save.
   */
  draft?: Partial<QualityInput>;
}) {
  const load = useServerFn(getRequisitionQuality);
  const { data, isLoading } = useQuery({
    queryKey: ["requisition-quality", positionId],
    queryFn: () => load({ data: { id: positionId } }),
  });

  const view = useMemo(() => {
    if (!data) return null;
    const merged = { ...data.input, ...draft } as QualityInput;
    
    // Ensure open_worldwide from the position object is considered if not in draft
    if (draft?.open_worldwide === undefined && (data.input as any).open_worldwide !== undefined) {
      merged.open_worldwide = (data.input as any).open_worldwide;
    }

    return { ...assessJobQuality(merged), input: merged };
  }, [data, draft]);


  if (isLoading || !view) {
    return <p className="text-sm text-muted-foreground">Checking job quality…</p>;
  }

  return (
    <div className={`rounded-md border p-3 ${TONE[view.readiness]}`}>
      <p className="text-sm font-medium">{view.summary}</p>
      {!compact && (
        <div className="mt-3 space-y-3">
          <GapList title="Blocks accurate scoring" gaps={view.blocking} onJumpToStep={onJumpToStep} editTo={editTo} />
          <GapList title="Weakens shortlist accuracy" gaps={view.degrades} onJumpToStep={onJumpToStep} editTo={editTo} />
          <GapList title="Nice to have" gaps={view.optional} onJumpToStep={onJumpToStep} editTo={editTo} />
        </div>
      )}
    </div>
  );
}
