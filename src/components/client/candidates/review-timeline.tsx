import type { ReviewStep, ReviewTimeline } from "@/lib/client/review-timeline";

const DOT: Record<ReviewStep["status"], string> = {
  done: "bg-success",
  active: "bg-primary animate-pulse",
  pending: "bg-muted-foreground/25",
  blocked: "bg-destructive",
};

const CONNECTOR: Record<ReviewStep["status"], string> = {
  done: "bg-success/50",
  active: "bg-primary/30",
  pending: "bg-muted-foreground/20",
  blocked: "bg-destructive/40",
};

/**
 * Compact four-step review timeline for a candidate row or card.
 * `showLabels` prints the step names (cards); rows use dots plus a caption.
 */
export function ReviewTimelineStrip({
  timeline,
  showLabels = false,
  className,
}: {
  timeline: ReviewTimeline;
  showLabels?: boolean;
  className?: string;
}) {
  const caption = timeline.steps[timeline.currentIndex]?.label ?? "";
  return (
    <div
      className={`min-w-[7.5rem] ${className ?? ""}`}
      title={timeline.steps.map((s) => s.note).join(" · ")}
      aria-label={`Application review: ${timeline.summary}`}
    >
      <div className="flex items-center gap-0.5">
        {timeline.steps.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-0.5 last:flex-none">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${DOT[s.status]}`}
              title={s.note}
              aria-hidden
            />
            {i < timeline.steps.length - 1 && (
              <span className={`h-0.5 flex-1 rounded-full ${CONNECTOR[s.status]}`} aria-hidden />
            )}
          </div>
        ))}
      </div>
      {showLabels ? (
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {timeline.steps.map((s) => (
            <span
              key={s.key}
              className={
                s.status === "done"
                  ? "text-foreground/70"
                  : s.status === "active"
                    ? "font-medium text-primary"
                    : s.status === "blocked"
                      ? "text-destructive"
                      : ""
              }
            >
              {s.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[11px] text-muted-foreground truncate">
          {timeline.currentIndex === timeline.steps.length - 1 &&
          timeline.steps[timeline.steps.length - 1].status === "done"
            ? "Shared with you"
            : caption}
        </p>
      )}
    </div>
  );
}
