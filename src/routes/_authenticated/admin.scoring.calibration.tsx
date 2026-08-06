import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { makeRouteErrorComponent, makeRouteNotFoundComponent } from "@/components/workspace/route-states";
import { getCalibrationDesk } from "@/lib/scoring/calibration-desk.functions";
import { CalibrationDistributionChart } from "@/components/admin/calibration-distribution-chart";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CalibrationDesk, SegmentDrift } from "@/lib/scoring/calibration-desk";

const deskQuery = {
  queryKey: ["calibration-desk"],
  queryFn: () => getCalibrationDesk({ data: {} }),
};

export const Route = createFileRoute("/_authenticated/admin/scoring/calibration")({
  loader: ({ context }) => context.queryClient.ensureQueryData(deskQuery),
  head: () => ({
    meta: [
      { title: "Calibration desk · TaaSFlow admin" },
      {
        name: "description",
        content:
          "Score and band performance against real outcomes: approvals, interviews held, offers, hires and decline reasons, with per-position and per-role-family drift.",
      },
      { property: "og:title", content: "Calibration desk · TaaSFlow admin" },
      {
        property: "og:description",
        content: "Staff view of scoring calibration against real hiring outcomes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalibrationDeskPage,
  errorComponent: makeRouteErrorComponent("admin", "_authenticated/admin.scoring.calibration"),
  notFoundComponent: makeRouteNotFoundComponent("admin"),
});

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function num(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
}

function FunnelStat({ label, value, of }: { label: string; value: number; of?: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {of !== undefined && of > 0 && (
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {Math.round((value / of) * 100)}% of {of} scored
        </div>
      )}
    </div>
  );
}

function SegmentTable({
  title, rows, hidden, emptyNote,
}: {
  title: string;
  rows: SegmentDrift[];
  hidden: number;
  emptyNote: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyNote}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">Segment</th>
                  <th className="py-1 pr-3 font-medium">Scored</th>
                  <th className="py-1 pr-3 font-medium">Median</th>
                  <th className="py-1 pr-3 font-medium">Drift</th>
                  <th className="py-1 pr-3 font-medium">Moved forward</th>
                  <th className="py-1 pr-3 font-medium">Hires</th>
                  <th className="py-1 font-medium">Bands seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{row.label}</div>
                      <div className="text-xs text-muted-foreground">{row.note}</div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{row.count}</td>
                    <td className="py-2 pr-3 tabular-nums">{num(row.median_score)}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.drift === null ? "—" : `${row.drift > 0 ? "+" : ""}${row.drift.toFixed(1)}`}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {row.approved} ({pct(row.approval_rate)})
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{row.hired}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {row.bands_used.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hidden > 0 && (
          <p className="text-xs text-muted-foreground">
            {hidden} segment{hidden === 1 ? "" : "s"} hidden with fewer than 3 scored candidates.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CalibrationDeskPage() {
  const { data } = useSuspenseQuery(deskQuery);
  const desk = data as CalibrationDesk;
  const f = desk.funnel;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Calibration desk</h1>
        <p className="text-sm text-muted-foreground">
          What the scale predicted against what actually happened. Test organisations and
          test records are excluded from every figure on this page.
        </p>
      </header>

      {desk.coverage_warning && (
        <Alert>
          <AlertDescription>{desk.coverage_warning}</AlertDescription>
        </Alert>
      )}

      {desk.total_scored === 0 ? (
        <Alert>
          <AlertDescription>
            No completed score runs outside test organisations yet. Nothing to calibrate.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Outcomes for scored candidates</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <FunnelStat label="Scored" value={f.scored} />
              <FunnelStat label="Moved forward" value={f.approved} of={f.scored} />
              <FunnelStat label="Interviews held" value={f.interviews_held} of={f.scored} />
              <FunnelStat label="Offers" value={f.offered} of={f.scored} />
              <FunnelStat label="Hires" value={f.hired} of={f.scored} />
              <FunnelStat label="Declined" value={f.declined} of={f.scored} />
              <FunnelStat label="Awaiting a decision" value={f.awaiting_decision} of={f.scored} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live scores against the band boundaries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={desk.range.compressed ? "destructive" : "secondary"}>
                  {desk.range.compressed ? "Range compressed" : "Range healthy"}
                </Badge>
                <span className="text-muted-foreground">{desk.range.headline}</span>
              </div>
              <CalibrationDistributionChart desk={desk} />
              <p className="text-xs text-muted-foreground tabular-nums">
                Min {num(desk.range.observed_min)} · Median {num(desk.range.observed_median)} · Max{" "}
                {num(desk.range.observed_max)}
                {desk.range.unreachable_bands.length > 0 &&
                  ` · Never reached: ${desk.range.unreachable_bands.join(", ")}`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Band performance</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 pr-3 font-medium">Band</th>
                    <th className="py-1 pr-3 font-medium">Range</th>
                    <th className="py-1 pr-3 font-medium">Produced</th>
                    <th className="py-1 pr-3 font-medium">Moved forward</th>
                    <th className="py-1 pr-3 font-medium">Hires</th>
                    <th className="py-1 pr-3 font-medium">Declined</th>
                    <th className="py-1 font-medium">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {desk.band_performance.map((band) => (
                    <tr key={band.band} className="border-t">
                      <td className="py-2 pr-3 font-medium">{band.label}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {band.min}–{band.max}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{band.produced_count}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {band.approved_count} ({pct(band.approval_rate)})
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{band.hired_count}</td>
                      <td className="py-2 pr-3 tabular-nums">{band.declined_count}</td>
                      <td className="py-2">
                        {band.never_produced ? (
                          <Badge variant="outline">Never produced</Badge>
                        ) : band.never_converts ? (
                          <Badge variant="destructive">Never converts</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why candidates were declined</CardTitle>
            </CardHeader>
            <CardContent>
              {desk.decline_reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No declines recorded for scored candidates yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {desk.decline_reasons.map((reason) => (
                    <li key={reason.code} className="flex items-baseline justify-between gap-4 text-sm">
                      <span>{reason.label}</span>
                      <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                        {reason.count} ({pct(reason.share)}) · mean score {num(reason.mean_score)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <SegmentTable
            title="Drift by position"
            rows={desk.by_position}
            hidden={desk.hidden_positions}
            emptyNote="No position has enough scored candidates yet to compare."
          />
          <SegmentTable
            title="Drift by role family"
            rows={desk.by_role_family}
            hidden={desk.hidden_role_families}
            emptyNote="No role family has enough scored candidates yet to compare."
          />
        </>
      )}
    </div>
  );
}
