import { SnapshotTile } from "@/components/client/candidates/snapshot-tile";

export function HiringSnapshot({
  overview,
  kpisLoading,
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
  orgSearch: string | undefined;
}) {
  return (
    <section aria-label="Hiring snapshot" className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <SnapshotTile
          label="Delivered"
          value={overview?.kpis.delivered}
          loading={kpisLoading && !overview}
          to="/client/candidates"
          org={orgSearch}
        />
        <SnapshotTile
          label="Top matches"
          value={overview?.kpis.top}
          loading={kpisLoading && !overview}
          to="/client/candidates"
          filter={{ fit: "strong" }}
          org={orgSearch}
        />
        <SnapshotTile
          label="Shortlisted"
          value={overview?.kpis.shortlisted}
          loading={kpisLoading && !overview}
          to="/client/candidates"
          filter={{ stage: "shortlisted" }}
          org={orgSearch}
        />
        <SnapshotTile
          label="Interviewing"
          value={overview?.kpis.interviewing}
          loading={kpisLoading && !overview}
          to="/client/candidates"
          filter={{ stage: "interview_process" }}
          org={orgSearch}
        />
        <SnapshotTile
          label="Offers"
          value={overview?.kpis.offers}
          loading={kpisLoading && !overview}
          to="/client/candidates"
          filter={{ stage: "offer" }}
          org={orgSearch}
        />
        <SnapshotTile
          label="Hires"
          value={overview?.kpis.hires}
          loading={kpisLoading && !overview}
          to="/client/candidates"
          filter={{ stage: "hired" }}
          org={orgSearch}
        />
      </div>
    </section>
  );
}
