import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ageTone, formatWaiting, formatAge } from "@/lib/time-age";

const TONE_CLASS: Record<string, string> = {
  fresh: "border-border bg-muted/50 text-muted-foreground",
  aging: "taas-bg-warning-soft taas-fg-warning border-transparent",
  overdue: "taas-bg-danger-soft taas-fg-danger border-transparent",
};

/**
 * Age badge for queue items — "waiting 3 days", escalating tone with age.
 */
export function AgeBadge({
  since,
  prefix = "waiting",
  thresholds,
  className,
}: {
  since: string | null | undefined;
  /** "waiting" renders "waiting 3 days"; "plain" renders just "3 days". */
  prefix?: "waiting" | "plain";
  thresholds?: { aging: number; overdue: number };
  className?: string;
}) {
  if (!since) return null;
  const label = prefix === "waiting" ? formatWaiting(since) : formatAge(since);
  if (!label) return null;
  const tone = ageTone(since, thresholds);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums",
        TONE_CLASS[tone],
        className,
      )}
      title={`Oldest item ${formatWaiting(since)}`}
    >
      <Clock className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
