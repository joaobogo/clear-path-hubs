import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { RoleStory } from "@/lib/client/role-story";
import { toFitPresentation } from "@/lib/client-fit-presentation";
import { FIT_OPTIONS } from "@/components/client/candidates/constants";

/**
 * The story of the search, in three figures: requirement coverage across the
 * shortlist, the fit spread of everyone delivered, and the next milestone.
 *
 * Nothing here is decoration. Every bar states its criteria, carries a takeaway
 * sentence, and links to the candidates behind the number.
 */

const SEGMENTS = [
  { key: "met" as const, label: "Evidenced", cls: "taas-bg-success" },
  { key: "partial" as const, label: "Partial", cls: "taas-bg-warning" },
  { key: "missing" as const, label: "No evidence yet", cls: "bg-muted-foreground/35" },
];

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {SEGMENTS.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${s.cls}`} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function SegmentedBar({
  met,
  partial,
  missing,
  label,
}: {
  met: number;
  partial: number;
  missing: number;
  label: string;
}) {
  const total = Math.max(1, met + partial + missing);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${label}: ${met} evidenced, ${partial} partial, ${missing} with no evidence yet`}
    >
      {met > 0 && <span className="taas-bg-success" style={{ width: pct(met) }} />}
      {partial > 0 && <span className="taas-bg-warning" style={{ width: pct(partial) }} />}
      {missing > 0 && (
        <span className="bg-muted-foreground/35" style={{ width: pct(missing) }} />
      )}
    </div>
  );
}

export function RoleStoryPanel({
  story,
  positionId,
  org,
}: {
  story: RoleStory;
  positionId: string;
  org?: string | null;
}) {
  const { coverage, distribution, milestone } = story;
  const candidatesSearch = (extra: Record<string, string>) =>
    ({ position: positionId, review: "all", ...(org ? { org } : {}), ...extra }) as never;

  return (
    <section aria-labelledby="role-story-heading" className="space-y-4">
      <h2 id="role-story-heading" className="sr-only">
        What this search shows so far
      </h2>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 1. Requirement coverage across the shortlist */}
        <div className="rounded-xl border bg-card p-4 sm:p-5 lg:col-span-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Requirement coverage across your shortlist
            </h3>
            <Link
              to="/client/candidates"
              search={candidatesSearch({})}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              See the evidence
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          {coverage.checks === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{coverage.takeaway}</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-foreground/90">{coverage.takeaway}</p>
              <div className="mt-3">
                <SegmentedBar
                  met={coverage.met}
                  partial={coverage.partial}
                  missing={coverage.missing}
                  label="All requirement checks"
                />
              </div>
              {/* Per-requirement detail is collapsed by default: the bar and
                  takeaway answer "are we covered?", the dropdown answers "how?" */}
              <details className="group mt-3 rounded-lg border bg-background/40">
                <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-primary hover:underline">
                  <span className="group-open:hidden">
                    Show requirement-by-requirement detail ({coverage.requirements.length})
                  </span>
                  <span className="hidden group-open:inline">Hide detail</span>
                </summary>
                <div className="border-t px-3 py-3">
                  <Legend />

                  <ul className="mt-4 space-y-3">
                    {coverage.requirements.map((r) => (
                      <li key={r.id}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="text-sm font-medium">
                            {r.label}
                            {r.importance === "preferred" && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                nice to have
                              </span>
                            )}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            Evidence extraction running
                          </span>
                        </div>
                        <div className="mt-1.5">
                          <SegmentedBar
                            met={r.met}
                            partial={r.partial}
                            missing={r.missing}
                            label={r.label}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.met > 0
                            ? `Proven by ${r.met_names.join(", ")}${r.met > r.met_names.length ? " and others" : ""}.`
                            : r.partial > 0
                              ? "Related experience only — worth probing at interview."
                              : "Evidence extraction is still running for this role."}
                        </p>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    {coverage.criteria}
                  </p>
                </div>
              </details>

            </>
          )}
        </div>

        <div className="space-y-4">
          {/* 2. Fit distribution of delivered candidates */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold">Fit spread of candidates delivered</h3>
            {distribution.scored === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{distribution.takeaway}</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-foreground/90">{distribution.takeaway}</p>
                <ul className="mt-3 space-y-2">
                  {distribution.bands.map((raw) => {
                    // The candidate list filters on the client-facing fit
                    // vocabulary, so a segment only links when it maps onto a
                    // filter the list actually offers.
                    const mapped = toFitPresentation(raw.key, null).band;
                    const b = {
                      ...raw,
                      filter: FIT_OPTIONS.some((o) => o.key === mapped) ? mapped : null,
                    };
                    const width = `${(b.count / Math.max(1, distribution.scored)) * 100}%`;
                    return (
                      <li key={b.key} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-xs text-muted-foreground">
                          {b.label}{" "}
                          <span className="tabular-nums">
                            {b.min}
                            {b.max >= 100 ? "+" : `–${b.max}`}
                          </span>
                        </span>
                        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          {b.count > 0 && (
                            <span
                              className={`block h-full ${b.min >= 70 ? "bg-primary" : b.min >= 50 ? "taas-bg-warning" : b.min >= 0 ? "bg-muted-foreground/35" : "bg-muted-foreground/10"}`}
                              style={{ width }}
                            />
                          )}
                        </span>
                        {b.count > 0 && b.filter ? (
                          <Link
                            to="/client/candidates"
                            search={candidatesSearch({ fit: b.filter })}
                            className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-primary hover:underline"
                          >
                            {b.count}
                          </Link>
                        ) : (
                          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            0
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  {distribution.criteria}
                </p>
              </>
            )}
          </div>

          {/* 3. Next milestone */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
              Next milestone
            </h3>
            <p className="mt-2 text-sm font-medium">{milestone.headline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{milestone.detail}</p>
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              {milestone.criteria}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
