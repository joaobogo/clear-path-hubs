// Job-quality indicator: names the missing decision-critical information
// instead of showing an arbitrary completeness percentage.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getRequisitionQuality } from "@/lib/requisition.functions";
import type { QualityGap } from "@/lib/requisition-schema";

const TONE: Record<string, string> = {
  not_scoreable: "border-destructive/40 bg-destructive/5",
  scoreable_with_gaps: "border-amber-500/40 bg-amber-500/5",
  decision_ready: "border-emerald-500/40 bg-emerald-500/5",
};

function GapList({
  title,
  gaps,
  onJumpToStep,
}: {
  title: string;
  gaps: QualityGap[];
  onJumpToStep?: (step: number) => void;
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
            {g.step && onJumpToStep && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onJumpToStep(g.step!)}>
                Fix in step {g.step}
              </Button>
            )}
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
}: {
  positionId: string;
  onJumpToStep?: (step: number) => void;
  compact?: boolean;
}) {
  const load = useServerFn(getRequisitionQuality);
  const { data, isLoading } = useQuery({
    queryKey: ["requisition-quality", positionId],
    queryFn: () => load({ data: { id: positionId } }),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Checking job quality…</p>;
  }

  return (
    <div className={`rounded-md border p-3 ${TONE[data.readiness]}`}>
      <p className="text-sm font-medium">{data.summary}</p>
      {!compact && (
        <div className="mt-3 space-y-3">
          <GapList title="Blocks accurate scoring" gaps={data.blocking} onJumpToStep={onJumpToStep} />
          <GapList title="Weakens shortlist accuracy" gaps={data.degrades} onJumpToStep={onJumpToStep} />
          <GapList title="Nice to have" gaps={data.optional} onJumpToStep={onJumpToStep} />
        </div>
      )}
    </div>
  );
}
