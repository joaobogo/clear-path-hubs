import { RoleProgressTracker } from "@/components/client/role-progress-tracker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

/**
 * "Where we are" kept deliberately simple: the five-stage tracker plus one
 * plain-language sentence. Dated milestones and the full system workflow were
 * removed — clients only need to know the stage and what it means.
 */
export function RoleStatusSection({
  progress,
  pipelineLine,
}: {
  progress: AnyRow;
  pipelineLine: string | undefined;
}) {
  return (
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
    </section>
  );
}
