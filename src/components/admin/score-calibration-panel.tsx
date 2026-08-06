/**
 * Score calibration panel (audit finding 12: "no calibration signal").
 *
 * Shows the observed score range, which configured bands have actually been
 * produced, and whether scores separate positive outcomes from rejections —
 * with an explicit coverage warning whenever the sample is too small to
 * trust. Never implies a band has candidates in it when it doesn't.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Gauge } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getCalibrationSignal } from "@/lib/scoring/calibration-signal.functions";
import { useIncludeTestRecords } from "@/lib/admin-scope";

function round(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

export function ScoreCalibrationPanel() {
  const fetchSignal = useServerFn(getCalibrationSignal);
  const includeTest = useIncludeTestRecords();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "calibration-signal", includeTest],
    queryFn: () => fetchSignal({ data: { include_test: includeTest } }),
  });

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <header className="flex items-center gap-2">
        <Gauge className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Score calibration</h2>
      </header>
      <p className="text-xs text-muted-foreground">
        How live scores compare to what actually happened to the candidate — not a
        judgement on any single score, a check on whether the scale means anything yet.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-sm text-destructive">Could not load calibration signal.</p>
      ) : data ? (
        <div className="space-y-4">
          {data.coverage_warning ? (
            <Alert variant="default" className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="size-4" />
              <AlertTitle>Small sample</AlertTitle>
              <AlertDescription>{data.coverage_warning}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Observed min</p>
              <p className="text-lg font-semibold">{round(data.observed_min)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Observed median</p>
              <p className="text-lg font-semibold">{round(data.observed_median)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Observed max</p>
              <p className="text-lg font-semibold">{round(data.observed_max)}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Band occupancy — which marketing bands have ever been produced
            </p>
            <div className="space-y-1.5">
              {data.band_occupancy.map((band) => (
                <div
                  key={band.band}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm"
                >
                  <span>
                    {band.label}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({band.min}–{band.max})
                    </span>
                  </span>
                  {band.ever_produced ? (
                    <Badge variant="secondary">{band.produced_count} scored</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Never produced
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border p-3 text-sm">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Outcome separation
            </p>
            <p className="mb-2">{data.discrimination.verdict}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                Positive outcomes (advanced/interviewed/offered/hired): n=
                {data.discrimination.positive_count}, mean{" "}
                {round(data.discrimination.positive_mean)}
              </span>
              <span>
                Rejected: n={data.discrimination.negative_count}, mean{" "}
                {round(data.discrimination.negative_mean)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {data.total_scored} completed score{data.total_scored === 1 ? "" : "s"} in scope,{" "}
            {data.total_with_outcome} with a downstream outcome recorded.
          </p>
        </div>
      ) : null}
    </section>
  );
}
