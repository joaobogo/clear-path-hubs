import { Link } from "@tanstack/react-router";
import { Chapter } from "@/components/home/chapters/chapter";
import { offer } from "@/config/offer";
import { RUN_CHAPTERS, RUN_SIGN_OFF_DAY } from "@/config/run-chapters";
import { SAMPLE_RUNS } from "@/lib/previews/representative-fixtures";

const chapter = RUN_CHAPTERS[5]!;
const DAYS = RUN_SIGN_OFF_DAY;

/**
 * Chapter 6, Proof (since launch, white). Figures the Results page publishes
 * (only those with a recorded source), and three representative runs drawn
 * on one day axis, each line turning from blue to ink as it closes.
 */
export function ChapterProof() {
  const figures = offer.proof;
  const hasFigures = figures.length > 0;

  return (
    <Chapter
      chapter={chapter}
      index={6}
      title={hasFigures ? "Roles filled, and counting." : "Representative runs, day by day."}
      lead="One run per sector, on the same clock. Example engagements built from representative data; clients are named only with their written approval."
    >
      {hasFigures ? (
        <dl className="mb-12 grid grid-cols-2 gap-6 border-b border-[color:var(--rule)] pb-10 sm:grid-cols-3 lg:grid-cols-5">
          {figures.map((f) => (
            <div key={f.label}>
              <dd className="wide num text-[44px] font-semibold leading-none text-[color:var(--blue-600)]">{f.value}</dd>
              <dt className="mt-2 text-sm text-[color:var(--slate)]">{f.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}

      <ol className="flex flex-col gap-6" aria-label="Three representative runs, brief to signed list">
        {SAMPLE_RUNS.map((r) => {
          const [h, m] = r.signedTime.split(":").map(Number);
          const closes = (r.signedDay + ((h ?? 0) * 60 + (m ?? 0)) / (24 * 60)) / DAYS;
          const pctClose = Math.min(100, closes * 100);
          return (
            <li key={r.sector} className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center">
              <div>
                <p className="font-semibold text-[color:var(--ink)]">{r.sector}</p>
                <p className="text-sm text-[color:var(--slate)]">{r.role}</p>
              </div>
              <div>
                <div className="relative h-3 w-full rounded-full bg-[color:var(--blue-100)]" role="img" aria-label={`${r.sector}: list signed Day ${r.signedDay}, ${r.signedTime}`}>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-[color:var(--blue-600)]" style={{ width: `${pctClose}%` }} />
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--ink)]"
                    style={{ left: `${pctClose}%` }}
                  />
                </div>
                <div className="num mt-2 flex justify-between text-[13px] text-[color:var(--faint)]">
                  <span>Day 0, 09:00 · brief approved</span>
                  <span className="text-[color:var(--ink)]">Day {r.signedDay}, {r.signedTime} · signed</span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-[15px] text-[color:var(--slate)]">
        Each run is drawn from an{" "}
        <Link to="/case-studies" className="font-medium text-[color:var(--blue-600)] underline underline-offset-4">
          example engagement
        </Link>
        , labelled {offer.proofLabel}.
      </p>
    </Chapter>
  );
}
