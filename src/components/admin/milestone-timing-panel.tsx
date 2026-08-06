// Timing section for /admin/operations.
// Every figure names its sample size; anything below the minimum sample is
// suppressed rather than shown with a caveat. Drill-through goes to the
// positions list filtered to the segment.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getMilestoneTimingReport } from "@/lib/milestone-timings.functions";
import { MILESTONES, MIN_SAMPLE, formatDays, type TimingSegment } from "@/lib/milestone-timings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { useScopedIncludeTest } from "@/lib/admin-scope";

const PERIODS = [30, 90, 180, 365] as const;

function SegmentTable({ segment, caption }: { segment: TimingSegment; caption?: string }) {
  return (
    <div className="space-y-2">
      {caption ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {caption}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Milestone</th>
              <th className="py-2 pr-3 font-medium">Median</th>
              <th className="py-2 pr-3 font-medium">Middle 50%</th>
              <th className="py-2 font-medium">Sample</th>
            </tr>
          </thead>
          <tbody>
            {segment.stats.map((s) => (
              <tr key={s.key} className="border-b last:border-0">
                <td className="py-2 pr-3">{s.label}</td>
                <td className="py-2 pr-3 tabular-nums">
                  {s.suppressed ? (
                    <span className="text-muted-foreground">Sample too small</span>
                  ) : (
                    <span className="font-semibold">{formatDays(s.median_days!)}</span>
                  )}
                </td>
                <td className="py-2 pr-3 tabular-nums text-muted-foreground">
                  {s.suppressed ? "—" : `${s.p25_days}–${s.p75_days} days`}
                </td>
                <td className="py-2 tabular-nums text-muted-foreground">
                  {s.sample} completed
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MilestoneTimingPanel() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(90);
  const [open, setOpen] = useState<string | null>(null);
  const fn = useServerFn(getMilestoneTimingReport);

  const q = useQuery({
    queryKey: ["milestone-timings", period],
    queryFn: () => fn({ data: { period_days: period, include_test: includeTest } }),
  });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Timing</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Measured from real records. Medians appear only where at least {MIN_SAMPLE} completed
            instances exist.
          </p>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === period ? "default" : "outline"}
              onClick={() => setPeriod(p)}
            >
              {p}d
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <PanelState
          query={q}
          isEmpty={(q.data?.overall.total_instances ?? 0) === 0}
          empty={
            <PanelEmpty
              title="Not enough completed roles to report timing"
              description="Figures appear once enough milestones have been completed."
            />
          }
        >
          {q.data && (
          <>
            <SegmentTable segment={q.data.overall} caption="All delivery" />

            {[
              { title: "By client", segments: q.data.by_client },
              { title: "By role family", segments: q.data.by_role_family },
            ].map((group) => (
              <div key={group.title} className="space-y-2 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </p>
                {group.segments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No segment has enough completed instances to report.
                  </p>
                ) : (
                  group.segments.map((seg) => {
                    const id = `${group.title}:${seg.id}`;
                    const isOpen = open === id;
                    return (
                      <div key={id} className="rounded-md border">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 p-3 text-left"
                          onClick={() => setOpen(isOpen ? null : id)}
                          aria-expanded={isOpen}
                        >
                          <span className="text-sm font-medium capitalize">{seg.label}</span>
                          <span className="flex items-center gap-2">
                            <Badge variant="outline">{seg.total_instances} completed</Badge>
                            <span className="text-xs text-muted-foreground">
                              {isOpen ? "Hide" : "Details"}
                            </span>
                          </span>
                        </button>
                        {isOpen ? (
                          <div className="space-y-3 border-t p-3">
                            <SegmentTable segment={seg} />
                            <div className="flex flex-wrap gap-2">
                              <span className="text-xs text-muted-foreground">
                                {seg.position_ids.length} role
                                {seg.position_ids.length === 1 ? "" : "s"} behind these figures:
                              </span>
                              {seg.position_ids.slice(0, 8).map((pid) => (
                                <Link
                                  key={pid}
                                  to="/admin/positions/$id"
                                  params={{ id: pid }}
                                  className="text-xs underline underline-offset-2"
                                >
                                  {pid.slice(0, 8)}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            ))}

            {q.data.suppressed_segments > 0 ? (
              <p className="border-t pt-4 text-xs text-muted-foreground">
                {q.data.suppressed_segments} segment
                {q.data.suppressed_segments === 1 ? " is" : "s are"} not shown: fewer than{" "}
                {MIN_SAMPLE} completed instances for any milestone.
              </p>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              Milestones measured: {MILESTONES.map((m) => m.label).join(" · ")}.
            </p>
          </>
          )}
        </PanelState>
      </CardContent>
    </Card>
  );
}
