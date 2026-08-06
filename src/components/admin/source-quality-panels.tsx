/**
 * Sourcing channel quality table.
 *
 * Absolute counts sit next to every rate, and a rate is blank with a "low
 * volume" marker whenever its denominator is under the suppression threshold —
 * a channel with 3 candidates never shows a percentage. Cost is shown only when
 * the underlying rows carry spend, and there are no recommendations here.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getPositionSourceQuality,
  getSourceQualityRollup,
} from "@/lib/admin-source-quality.functions";
import { formatRate, type ChannelQuality, type Rate, type SourceQuality } from "@/lib/source-quality";
import type { ChannelCandidate } from "@/lib/admin-source-quality.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

const CHANNEL_LABEL: Record<string, string> = {
  unknown: "Unattributed",
  inbound: "Inbound",
  job_board: "Job board",
  linkedin: "LinkedIn",
  referral: "Referral",
  outreach: "Outreach",
};

const label = (channel: string) =>
  CHANNEL_LABEL[channel] ?? channel.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function RateCell({ rate }: { rate: Rate }) {
  return (
    <span className="tabular-nums">
      <span className="font-medium">{formatRate(rate)}</span>
      <span className="ml-1.5 text-xs text-muted-foreground">
        {rate.numerator}/{rate.denominator}
        {rate.suppressed && rate.denominator > 0 ? " · low volume" : ""}
      </span>
    </span>
  );
}

function QualityTable({
  data,
  candidatesByChannel,
}: {
  data: SourceQuality;
  candidatesByChannel?: Record<string, ChannelCandidate[]>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Channel</th>
            <th className="px-3 py-2 text-right">Candidates</th>
            <th className="px-3 py-2 text-right">Submitted</th>
            <th className="px-3 py-2 text-right">Client accepted</th>
            <th className="px-3 py-2 text-right">Hired</th>
            <th className="px-3 py-2">Submit rate</th>
            <th className="px-3 py-2">Accept rate</th>
            <th className="px-3 py-2">Hire rate</th>
            {data.totals.has_spend && <th className="px-3 py-2 text-right">Spend</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.channels.map((c: ChannelQuality) => {
            const list = candidatesByChannel?.[c.channel];
            const expandable = !!list && list.length > 0;
            const isOpen = open === c.channel;
            return (
              <>
                <tr key={c.channel} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    {expandable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                        onClick={() => setOpen(isOpen ? null : c.channel)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                        {label(c.channel)}
                      </button>
                    ) : (
                      <span className="font-medium">{label(c.channel)}</span>
                    )}
                    {c.kinds.length > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {c.kinds.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.candidates}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.submitted}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.accepted}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.hired}</td>
                  <td className="px-3 py-2.5">
                    <RateCell rate={c.submitted_rate} />
                  </td>
                  <td className="px-3 py-2.5">
                    <RateCell rate={c.accepted_rate} />
                  </td>
                  <td className="px-3 py-2.5">
                    <RateCell rate={c.hire_rate} />
                  </td>
                  {data.totals.has_spend && (
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                      {c.has_spend ? `$${Math.round(c.spend_cents / 100).toLocaleString()}` : "—"}
                    </td>
                  )}
                </tr>
                {isOpen && list && (
                  <tr key={`${c.channel}-candidates`} className="bg-muted/30">
                    <td colSpan={data.totals.has_spend ? 9 : 8} className="px-4 py-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        {list.length} candidate{list.length === 1 ? "" : "s"} attributed to{" "}
                        {label(c.channel)}
                      </p>
                      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                        {list.map((cand) => (
                          <li key={cand.application_id} className="text-sm">
                            {cand.match_id ? (
                              <Link
                                to="/admin/candidates/$id"
                                params={{ id: cand.match_id }}
                                className="hover:underline"
                              >
                                {cand.name}
                              </Link>
                            ) : (
                              <span>{cand.name}</span>
                            )}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {cand.hired ? "hired" : cand.stage ? cand.stage : "no match yet"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
          <tr className="border-t-2 bg-muted/20 font-medium">
            <td className="px-4 py-2.5">All channels</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{data.totals.candidates}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{data.totals.submitted}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{data.totals.accepted}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{data.totals.hired}</td>
            <td colSpan={data.totals.has_spend ? 4 : 3} className="px-3 py-2.5" />
          </tr>
        </tbody>
      </table>
      <p className="px-4 py-2 text-xs text-muted-foreground">
        Rates are hidden until the denominator reaches {data.min_rate_denominator}.
      </p>
    </div>
  );
}

function Frame({
  title,
  subtitle,
  children,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh channel quality"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </header>
      {children}
    </section>
  );
}

/** Per-position channel quality with a drill-down into each channel's candidates. */
export function PositionSourceQualityPanel({ positionId }: { positionId: string }) {
  const query = useQuery({
    queryKey: ["admin", "position-source-quality", positionId],
    queryFn: () => getPositionSourceQuality({ data: { position_id: positionId } }),
    staleTime: 60_000,
  });

  return (
    <Frame
      title="Sourcing channel quality"
      subtitle="Where this role's candidates came from, and how far each channel actually got."
      onRefresh={() => query.refetch()}
      refreshing={query.isFetching}
    >
      <PanelState
        query={query}
        isEmpty={(query.data?.channels.length ?? 0) === 0}
        empty={
          <PanelEmpty className="px-4 py-10" title="No attributed candidates yet" />
        }
      >
        {query.data && (
          <QualityTable data={query.data} candidatesByChannel={query.data.candidates_by_channel} />
        )}
      </PanelState>
    </Frame>
  );
}

/** Cross-client rollup for /admin/operations. */
export function SourceQualityRollupPanel({ includeTest = false }: { includeTest?: boolean }) {
  const query = useQuery({
    queryKey: ["admin", "source-quality-rollup", includeTest],
    queryFn: () => getSourceQualityRollup({ data: { include_test: includeTest } }),
    staleTime: 60_000,
  });

  return (
    <Frame
      title="Sourcing channel quality — all clients"
      subtitle="Channel performance across the portfolio. Counts come from attribution, not estimates."
      onRefresh={() => query.refetch()}
      refreshing={query.isFetching}
    >
      <PanelState
        query={query}
        isEmpty={(query.data?.channels.length ?? 0) === 0}
        empty={
          <PanelEmpty className="px-4 py-10" title="No attributed candidates yet" />
        }
      >
        {query.data && (
          <>
            <div className="flex flex-wrap gap-1.5 border-b px-4 py-2">
              <Badge variant="outline">{query.data.totals.candidates} candidates attributed</Badge>
              <Badge variant="outline">{query.data.totals.hired} hired</Badge>
            </div>
            <QualityTable data={query.data} />
          </>
        )}
      </PanelState>
    </Frame>
  );
}
