import { SnapshotTile } from "@/components/client/candidates/snapshot-tile";
import { QueryErrorCard } from "@/components/client/query-error";
import { stageDisplayName } from "@/lib/client/stage-display";
import type { ClientCandidateKpis } from "@/lib/client/candidate-kpi";

export type HiringSnapshotKpis = Partial<ClientCandidateKpis>;

/**
 * Two rows of figures that answer two different questions, and never mix them.
 *
 * The first row is the pipeline: every shared candidate sits in exactly one
 * stage, so those tiles add up to the total shown beside the heading and to the
 * list below. The second row holds figures that are not stages — a fit segment
 * and the review queue — which overlap the stages and are labelled as such, so
 * nobody reads them as part of the same total.
 */
export function HiringSnapshot({
  kpis,
  loading,
  isError = false,
  error,
  onRetry,
  retrying = false,
  orgSearch,
  /**
   * Candidates waiting on the client's decision, from the one canonical reader
   * the Overview queue uses. Passing it here is what keeps the two "awaiting"
   * figures in the workspace to a single number.
   */
  awaitingDecision,
}: {
  kpis: HiringSnapshotKpis | undefined;
  loading: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  orgSearch: string | undefined;
  awaitingDecision?: number;
}) {
  if (isError) {
    return (
      <section aria-label="Hiring snapshot" className="mb-6">
        <QueryErrorCard
          compact
          title="We couldn't load your candidate totals"
          error={error}
          onRetry={onRetry}
          retrying={retrying}
        />
      </section>
    );
  }

  const part = kpis?.stage_partition;
  const total = kpis?.delivered;
  const skeleton = loading && !kpis;

  // A tile never holds a skeleton once the figures arrived, and never invents a
  // zero when they didn't: a missing figure reads as a dash plus a short reason.
  const stageTiles = [
    { label: stageDisplayName("delivered"), value: part?.awaiting, filter: { stage: "delivered" } },
    { label: stageDisplayName("shortlisted"), value: part?.shortlisted, filter: { stage: "shortlisted" } },
    {
      label: stageDisplayName("interview_process"),
      value: part?.interviewing,
      filter: { stage: "interview_process" },
    },
    { label: stageDisplayName("offer"), value: part?.offer, filter: { stage: "offer" } },
    { label: stageDisplayName("hired"), value: part?.hired, filter: { stage: "hired" } },
    {
      label: stageDisplayName("not_moving_forward"),
      value: part?.closed,
      filter: { stage: "not_moving_forward" },
      onlyWhenPositive: true,
    },
    {
      label: "In review with us",
      value: part?.elsewhere,
      filter: undefined,
      onlyWhenPositive: true,
    },
  ].filter((t) => !t.onlyWhenPositive || (t.value ?? 0) > 0);

  const segmentTiles: Array<{ label: string; value: number | undefined; filter: Record<string, string> }> = [
    // Links through the KPI drill-through key, not a single band, so the tile
    // and the list it opens always count the same candidates.
    { label: "Strongest fit", value: kpis?.top, filter: { filter: "top" } },
    {
      label: "Waiting on your decision",
      value: awaitingDecision ?? part?.awaiting,
      filter: { stage: "delivered" },
    },
  ];

  return (
    <section aria-label="Hiring snapshot" className="mb-6 space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Where your candidates are
          </h2>
          <span className="text-xs text-muted-foreground">
            {skeleton || total === undefined
              ? "One stage each"
              : `Adds up to ${total} candidate${total === 1 ? "" : "s"}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {stageTiles.map((tile) => (
            <SnapshotTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              loading={skeleton}
              to="/client/candidates"
              filter={tile.filter as Record<string, string> | undefined}
              org={orgSearch}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Ways of looking at the same people
          </h2>
          <span className="text-xs text-muted-foreground">
            Not stages — these overlap with the row above
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {segmentTiles.map((tile) => (
            <div key={tile.label} className="rounded-xl border border-dashed bg-muted/20 p-0.5">
              <SnapshotTile
                label={tile.label}
                value={tile.value}
                loading={skeleton}
                to="/client/candidates"
                filter={tile.filter as Record<string, string> | undefined}
                org={orgSearch}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
