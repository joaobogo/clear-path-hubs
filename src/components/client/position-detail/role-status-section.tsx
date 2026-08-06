import { RoleProgressTracker } from "@/components/client/role-progress-tracker";
import { RoleDatedTimeline } from "@/components/client/role-dated-timeline";
import { RoleLifecycleTimeline } from "@/components/client/role-lifecycle-timeline";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export function RoleStatusSection({
  progress,
  pipelineLine,
  timeline,
  timelineLoading,
  lifecycle,
  onRetry,
}: {
  progress: AnyRow;
  pipelineLine: string | undefined;
  timeline: AnyRow;
  timelineLoading: boolean;
  lifecycle: AnyRow;
  onRetry: () => void;
}) {
  return (
    <>
      {/* Where we are — persistent five-stage tracker + plain-language status */}
      <section className="rounded-xl border bg-card px-4 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Where we are
        </h2>
        <div className="mt-3">
          <RoleProgressTracker progress={progress} />
        </div>
        {pipelineLine && (
          <p className="mt-3 border-t pt-3 text-sm font-medium text-foreground/90">
            {pipelineLine}
          </p>
        )}
        <div className="mt-4 border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </h3>
          <div className="mt-3">
            <RoleDatedTimeline
              timeline={timeline}
              isLoading={timelineLoading}
              onRetry={onRetry}
            />
          </div>
        </div>
      </section>

      {/* Full system workflow — Intake through Hire, derived from real records */}
      <section className="rounded-xl border bg-card px-4 py-4">
        <RoleLifecycleTimeline
          lifecycle={lifecycle}
          isLoading={false}
          onRetry={onRetry}
        />
      </section>
    </>
  );
}
