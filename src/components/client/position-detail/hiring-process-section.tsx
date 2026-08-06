import { ProcessStep } from "./process-step";

export function HiringProcessSection({
  mattersCount,
  shortlistedTotal,
  interviewingTotal,
  offersTotal,
  hiresTotal,
  openings,
}: {
  mattersCount: number;
  shortlistedTotal: number;
  interviewingTotal: number;
  offersTotal: number;
  hiresTotal: number;
  openings: number;
}) {
  return (
    <section aria-label="Hiring process" className="rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold mb-3">Hiring process</h2>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <ProcessStep
          n={1}
          title="Delivered"
          body="TaaSFlow reviews sourced candidates and only delivers those cleared for your role."
          done={mattersCount > 0}
        />
        <ProcessStep
          n={2}
          title="Shortlist"
          body="You mark candidates worth advancing. Others are moved to Not moving forward."
          done={shortlistedTotal > 0}
        />
        <ProcessStep
          n={3}
          title="Interview"
          body="Your team runs interviews. Schedule and outcomes are logged automatically."
          done={interviewingTotal > 0}
        />
        <ProcessStep
          n={4}
          title="Offer"
          body="Extend an offer through TaaSFlow so we can track acceptance."
          done={offersTotal > 0}
        />
        <ProcessStep
          n={5}
          title="Hire"
          body={
            openings > 1
              ? `Multiple hires — ${hiresTotal} of ${openings} filled.`
              : "Position closes once the first hire is confirmed."
          }
          done={hiresTotal >= openings}
        />
      </ol>
    </section>
  );
}
