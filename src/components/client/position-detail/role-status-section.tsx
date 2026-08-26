import { RoleProgressTracker } from "@/components/client/role-progress-tracker";
import { formatStageDate, type RoleProgress } from "@/lib/client-role-progress";

/**
 * "Where we are" — the only stage tracker on the client role page.
 *
 * The agent machinery (workflow rows, sourcing engine, network capabilities,
 * channel mix, hiring-process explainer) is deliberately not shown to clients.
 * It collapses to one honest line driven by the same derived state as the
 * tracker: what is running, and when it last moved.
 */
export function RoleStatusSection({
  progress,
  pipelineLine,
}: {
  progress: RoleProgress | null | undefined;
  pipelineLine: string | undefined;
}) {
  const lastUpdate = formatStageDate(progress?.lastUpdateAt ?? null);
  const engineLine = (() => {
    if (!progress) return null;
    // Driven by the tracker's own current stage, so this line can never claim
    // sourcing is running while the stepper shows sourcing completed.
    const sourcing = progress.steps.find((s) => s.key === "sourcing");
    const state = sourcing?.state ?? "upcoming";
    if (progress.inactive) {
      return lastUpdate ? `Sourcing is paused — last update ${lastUpdate}` : "Sourcing is paused";
    }
    if (state === "upcoming") return "Sourcing hasn't started yet";
    if (state === "done") {
      const stage = progress.currentLabel.toLowerCase();
      return lastUpdate
        ? `Sourcing complete — now at ${stage}, last update ${lastUpdate}`
        : `Sourcing complete — now at ${stage}`;
    }
    if (!lastUpdate) return "Sourcing is running";
    return `Sourcing is running — last update ${lastUpdate}`;
  })();


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
      {engineLine && (
        <p className="mt-1.5 text-xs text-muted-foreground">{engineLine}</p>
      )}
    </section>
  );
}
