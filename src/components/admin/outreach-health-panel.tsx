/**
 * Outreach health panel — deliverability and opt-out monitor.
 *
 * Counts per channel for the last 7 and 30 days sit next to the current channel
 * rule limits and how close usage is to them. Rates only appear (and only warn)
 * above the stated volume floors; below them the cells read "counts only" rather
 * than a misleading percentage. No sender-reputation score, no inbox placement.
 */
import { Fragment, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIncludeTestRecords } from "@/lib/admin-scope";
import {
  getOutreachHealth,
} from "@/lib/admin-outreach-health.functions";
import {
  BOUNCE_MIN_SENDS,
  BOUNCE_RATE_THRESHOLD,
  OPT_OUT_MIN_SENDS,
  OPT_OUT_RATE_THRESHOLD,
  channelLabel,
  formatPct,
  type WindowDays,
  type WindowStats,
} from "@/lib/outreach-health";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(APP_LOCALE, { timeZone: WORKSPACE_TIMEZONE, month: "short", day: "numeric" });

function RateCell({
  stats,
  kind,
}: {
  stats: WindowStats;
  kind: "bounce" | "opt_out";
}) {
  const suppressed =
    kind === "bounce" ? stats.bounce_rate_suppressed : stats.opt_out_rate_suppressed;
  const value = kind === "bounce" ? stats.bounce_rate : stats.opt_out_rate;
  const warn = kind === "bounce" ? stats.bounce_warning : stats.opt_out_warning;
  const numerator = kind === "bounce" ? stats.bounced : stats.opted_out;
  const floor = kind === "bounce" ? BOUNCE_MIN_SENDS : OPT_OUT_MIN_SENDS;

  return (
    <span className="tabular-nums">
      <span className={warn ? "font-semibold text-destructive" : undefined}>
        {formatPct(value)}
      </span>
      <span className="ml-1 text-xs text-muted-foreground">
        {numerator}/{stats.sent}
        {suppressed ? ` · counts only under ${floor} sends` : ""}
      </span>
    </span>
  );
}

function WindowRow({ stats }: { stats: WindowStats }) {
  return (
    <tr className="border-t border-border/60">
      <td className="py-2 pl-6 pr-3 text-muted-foreground">Last {stats.window_days} days</td>
      <td className="px-3 py-2 tabular-nums">{stats.sent}</td>
      <td className="px-3 py-2 tabular-nums">{stats.delivered}</td>
      <td className="px-3 py-2 tabular-nums">{stats.bounced}</td>
      <td className="px-3 py-2 tabular-nums">{stats.replied}</td>
      <td className="px-3 py-2 tabular-nums">{stats.opted_out}</td>
      <td className="px-3 py-2">
        <RateCell stats={stats} kind="bounce" />
      </td>
      <td className="px-3 py-2">
        <RateCell stats={stats} kind="opt_out" />
      </td>
    </tr>
  );
}

export function OutreachHealthPanel() {
  // Global admin scope; this panel no longer owns its own filter.
  const includeTest = useIncludeTestRecords();
  const [detail, setDetail] = useState<"none" | "bounces" | "opt_outs">("none");
  const fetchHealth = useServerFn(getOutreachHealth);

  const query = useQuery({
    queryKey: ["admin", "outreach-health", includeTest],
    queryFn: () => fetchHealth({ data: { include_test: includeTest } }),
  });

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">Outreach health</h2>
        <p className="text-sm text-muted-foreground">
          Deliverability and opt-out trend per channel.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
    </div>
  );

  const data = query.data;
  const warnings = data
    ? data.channels.filter(
        (c) =>
          c.windows[7].bounce_warning ||
          c.windows[30].bounce_warning ||
          c.windows[7].opt_out_warning ||
          c.windows[30].opt_out_warning,
      )
    : [];
  const hasActivity = data ? data.totals[30].sent > 0 || data.totals[30].opted_out > 0 : false;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      {header}

      <PanelState
        query={query}
        isEmpty={!hasActivity}
        className="mt-4"
        empty={<PanelEmpty className="mt-4" title="No outreach activity" description="No outreach activity in this period." />}
      >
      {data && (
      <>
      {warnings.length > 0 && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {warnings.map((c) => channelLabel(c.channel)).join(", ")} above threshold — bounces over{" "}
            {formatPct(BOUNCE_RATE_THRESHOLD)} ({BOUNCE_MIN_SENDS}+ sends) or opt-outs over{" "}
            {formatPct(OPT_OUT_RATE_THRESHOLD)} ({OPT_OUT_MIN_SENDS}+ sends).
          </AlertDescription>
        </Alert>
      )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Sent</th>
                <th className="px-3 py-2 font-medium">Delivered</th>
                <th className="px-3 py-2 font-medium">Bounced</th>
                <th className="px-3 py-2 font-medium">Replied</th>
                <th className="px-3 py-2 font-medium">Opted out</th>
                <th className="px-3 py-2 font-medium">Bounce rate</th>
                <th className="px-3 py-2 font-medium">Opt-out rate</th>
              </tr>
            </thead>
            <tbody>
              {data.channels.map((c) => (
                <Fragment key={c.channel}>
                  <tr className="border-t border-border">
                    <td className="py-2 pr-3 font-medium" colSpan={8}>
                      {channelLabel(c.channel)}
                    </td>
                  </tr>
                  {([7, 30] as WindowDays[]).map((w) => (
                    <WindowRow key={`${c.channel}-${w}`} stats={c.windows[w]} />
                  ))}
                </Fragment>
              ))}
              <tr className="border-t-2 border-border font-medium">
                <td className="py-2 pr-3">All channels · 30 days</td>
                <td className="px-3 py-2 tabular-nums">{data.totals[30].sent}</td>
                <td className="px-3 py-2 tabular-nums">{data.totals[30].delivered}</td>
                <td className="px-3 py-2 tabular-nums">{data.totals[30].bounced}</td>
                <td className="px-3 py-2 tabular-nums">{data.totals[30].replied}</td>
                <td className="px-3 py-2 tabular-nums">{data.totals[30].opted_out}</td>
                <td className="px-3 py-2">
                  <RateCell stats={data.totals[30]} kind="bounce" />
                </td>
                <td className="px-3 py-2">
                  <RateCell stats={data.totals[30]} kind="opt_out" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
      )}
      </PanelState>

      {data && (
      <>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={detail === "bounces" ? "default" : "outline"}
          onClick={() => setDetail(detail === "bounces" ? "none" : "bounces")}
        >
          Bounce list ({data.bounces.length})
        </Button>
        <Button
          size="sm"
          variant={detail === "opt_outs" ? "default" : "outline"}
          onClick={() => setDetail(detail === "opt_outs" ? "none" : "opt_outs")}
        >
          Opt-out list ({data.opt_out_items.length})
        </Button>
      </div>

      {detail === "bounces" && (
        <div className="mt-3 rounded-lg border border-border">
          {data.bounces.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No bounces in this period.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.bounces.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                  <span className="font-medium">
                    {b.candidate_profile_id ? (
                      <Link
                        to="/admin/candidates/$id"
                        params={{ id: b.candidate_profile_id }}
                        className="underline underline-offset-2"
                      >
                        {b.candidate_name ?? "Unnamed candidate"}
                      </Link>
                    ) : (
                      (b.candidate_name ?? "Unnamed candidate")
                    )}
                  </span>
                  <Badge variant="outline">{channelLabel(b.channel)}</Badge>
                  <span className="text-muted-foreground">{b.org_name ?? "—"}</span>
                  <span className="text-muted-foreground">{fmtDate(b.sent_at)}</span>
                  {b.error && <span className="text-destructive">{b.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {detail === "opt_outs" && (
        <div className="mt-3 rounded-lg border border-border">
          {data.opt_out_items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No opt-outs in this period.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.opt_out_items.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                  <span className="font-medium">
                    {o.candidate_profile_id ? (
                      <Link
                        to="/admin/candidates/$id"
                        params={{ id: o.candidate_profile_id }}
                        className="underline underline-offset-2"
                      >
                        {o.candidate_name ?? o.email ?? "Unnamed candidate"}
                      </Link>
                    ) : (
                      (o.candidate_name ?? o.email ?? "Unknown contact")
                    )}
                  </span>
                  <Badge variant="outline">
                    {o.channel ? channelLabel(o.channel) : "All channels"}
                  </Badge>
                  <span className="text-muted-foreground">{o.org_name ?? "—"}</span>
                  <span className="text-muted-foreground">{fmtDate(o.created_at)}</span>
                  {o.reason && <span className="text-muted-foreground">{o.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}


      <p className="mt-4 text-xs text-muted-foreground">
        Rates are suppressed below {BOUNCE_MIN_SENDS} sends (bounce) and {OPT_OUT_MIN_SENDS} sends
        (opt-out). Touch history is read over the last {data.loaded_days} days.
      </p>
      </>
      )}
    </section>
  );
}
