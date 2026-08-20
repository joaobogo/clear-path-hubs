import { SnapshotTile } from "@/components/client/candidates/snapshot-tile";
import { QueryErrorCard } from "@/components/client/query-error";

/**
 * Six figures, and never a lie: if the numbers didn't load, the tiles say so
 * and offer a Retry instead of holding a skeleton or showing a hopeful zero.
 */
export function HiringSnapshot({
  overview,
  kpisLoading,
  isError = false,
  error,
  onRetry,
  retrying = false,
  orgSearch,
}: {
  overview: {
    kpis: {
      delivered?: number;
      top?: number;
      shortlisted?: number;
      interviewing?: number;
      offers?: number;
      hires?: number;
    };
  } | undefined;
  kpisLoading: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  orgSearch: string | undefined;
}) {
  if (isError) {
    return (
      <section aria-label="Hiring snapshot" className="mb-6">
        <QueryErrorCard
          compact
          title="We couldn't load your hiring figures"
          error={error}
          onRetry={onRetry}
          retrying={retrying}
        />
      </section>
    );
  }

  const kpis = overview?.kpis;
  // A tile never holds a skeleton once the figures arrived, and never invents a
  // zero when they didn't: a missing figure reads as a dash plus a short reason.
  const tiles = [
    { label: "Delivered", value: kpis?.delivered, filter: undefined, hint: "None delivered yet" },
    {
      label: "Strongest candidates",
      value: kpis?.top,
      filter: { fit: "strong" },
      hint: "No strong fits yet",
    },
    {
      label: "Shortlisted",
      value: kpis?.shortlisted,
      filter: { stage: "shortlisted" },
      hint: "Nothing shortlisted",
    },
    {
      label: "Interviewing",
      value: kpis?.interviewing,
      filter: { stage: "interview_process" },
      hint: "No interviews yet",
    },
    { label: "Offers", value: kpis?.offers, filter: { stage: "offer" }, hint: "No offers out" },
    { label: "Hires", value: kpis?.hires, filter: { stage: "hired" }, hint: "No hires yet" },
  ] as const;

  return (
    <section aria-label="Hiring snapshot" className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map((tile) => (
          <SnapshotTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            loading={kpisLoading && !overview}
            to="/client/candidates"
            filter={tile.filter as Record<string, string> | undefined}
            org={orgSearch}
            emptyHint={tile.hint}
          />
        ))}
      </div>
    </section>
  );
}

