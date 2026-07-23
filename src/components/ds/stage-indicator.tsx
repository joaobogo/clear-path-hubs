import { cn } from "@/lib/utils";

/**
 * Pipeline stage chip. VISUAL ONLY — passes through the stage key
 * verbatim; does not remap, group, or reorder stages, does not alter
 * queue logic or permissions. Unknown stages fall back to neutral.
 */

export type PipelineStage =
  | "new"
  | "review"
  | "shortlisted"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

const stageColor: Record<PipelineStage, string> = {
  new: "var(--taas-stage-new)",
  review: "var(--taas-stage-review)",
  shortlisted: "var(--taas-stage-shortlisted)",
  interview: "var(--taas-stage-interview)",
  offer: "var(--taas-stage-offer)",
  hired: "var(--taas-stage-hired)",
  rejected: "var(--taas-stage-rejected)",
  withdrawn: "var(--taas-stage-withdrawn)",
};

const stageLabel: Record<PipelineStage, string> = {
  new: "New",
  review: "In review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export interface StageIndicatorProps {
  stage: string | null | undefined;
  className?: string;
  /** Override the visible label without changing the underlying stage key. */
  label?: string;
}

export function StageIndicator({ stage, label, className }: StageIndicatorProps) {
  const key = (stage ?? "").toLowerCase() as PipelineStage;
  const isKnown = key in stageColor;
  const color = isKnown ? stageColor[key] : "var(--taas-status-neutral)";
  const visible = label ?? (isKnown ? stageLabel[key] : (stage ?? "—"));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
        color,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 28%, transparent)`,
      }}
      aria-label={`Stage: ${visible}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {visible}
    </span>
  );
}
