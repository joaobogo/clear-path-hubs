import { Radar, TrendingUp, Users, Send, MailCheck, Trophy, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ChannelRow } from "@/lib/sources.functions";

function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
}
function money(cents: number | null | undefined): string {
  if (!cents) return "—";
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const KIND_TONE: Record<string, string> = {
  inbound: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  sourced: "bg-primary/10 text-primary",
  referral: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  agency: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  event: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  rehire: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export type SourceRollup = {
  channels: ChannelRow[];
  totals: {
    applications: number;
    outreach_sent: number;
    outreach_replied: number;
    shortlisted: number;
    interviewed: number;
    offered: number;
    hired: number;
    total_cost_cents: number;
  };
  split: { inbound: number; sourced: number; referral: number; hires: Record<string, number> };
};

export function SourceAttributionView({
  data,
  title = "Source of hire",
  subtitle,
}: {
  data: SourceRollup;
  title?: string;
  subtitle?: string;
}) {
  const { channels, totals, split } = data;
  const totalApps = totals.applications || 1;
  const replyRate = totals.outreach_sent > 0 ? totals.outreach_replied / totals.outreach_sent : null;
  const shortlistRate = totals.applications > 0 ? totals.shortlisted / totals.applications : null;
  const hireRate = totals.applications > 0 ? totals.hired / totals.applications : null;
  const costPerHire = totals.hired > 0 && totals.total_cost_cents > 0
    ? Math.round(totals.total_cost_cents / totals.hired)
    : null;

  const splitBars: Array<{ label: string; count: number; tone: string }> = [
    { label: "Sourced", count: split.sourced, tone: "bg-primary" },
    { label: "Inbound", count: split.inbound, tone: "bg-slate-400" },
    { label: "Referral", count: split.referral, tone: "bg-emerald-500" },
  ];

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Radar className="h-3.5 w-3.5" />
            Channel attribution
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
          )}
        </div>
      </header>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={Users} label="Applications" value={totals.applications.toLocaleString()} />
        <Kpi icon={Send} label="Outreach sent" value={totals.outreach_sent.toLocaleString()} />
        <Kpi icon={MailCheck} label="Reply rate" value={pct(replyRate)} />
        <Kpi icon={TrendingUp} label="Shortlist rate" value={pct(shortlistRate)} />
        <Kpi icon={Trophy} label="Hires" value={totals.hired.toLocaleString()} tone="primary" />
        <Kpi icon={DollarSign} label="Cost / hire" value={money(costPerHire)} />
      </div>

      {/* Sourced vs Inbound split */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sourced vs inbound split</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {splitBars.map((b) => {
            const share = b.count / totalApps;
            const hires = split.hires?.[b.label.toLowerCase()] ?? 0;
            return (
              <div key={b.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{b.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {b.count} apps · {hires} hires · {pct(share)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${b.tone} rounded-full transition-all`}
                    style={{ width: `${Math.min(100, share * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {totals.applications === 0 && (
            <p className="text-sm text-muted-foreground">
              No applications yet — this proves nothing but the system is ready.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Channel funnel table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Channel funnel</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Channel</th>
                  <th className="px-3 py-2 text-left font-medium">Kind</th>
                  <th className="px-3 py-2 text-right font-medium">Apps</th>
                  <th className="px-3 py-2 text-right font-medium">Sent</th>
                  <th className="px-3 py-2 text-right font-medium">Reply</th>
                  <th className="px-3 py-2 text-right font-medium">Shortlist</th>
                  <th className="px-3 py-2 text-right font-medium">Offer</th>
                  <th className="px-3 py-2 text-right font-medium">Hire</th>
                  <th className="px-3 py-2 text-right font-medium">Hire rate</th>
                  <th className="px-3 py-2 text-right font-medium">Cost / hire</th>
                </tr>
              </thead>
              <tbody>
                {channels.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      No channel data yet. Tag applications with a source_channel to build attribution.
                    </td>
                  </tr>
                )}
                {channels.map((c) => (
                  <tr
                    key={`${c.channel}::${c.kind}`}
                    className="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2 font-medium">{c.channel}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className={`${KIND_TONE[c.kind] ?? KIND_TONE.other} border-0`}>
                        {c.kind}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.applications}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {c.outreach_sent || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(c.reply_rate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(c.shortlist_rate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.offered}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{c.hired}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(c.hire_rate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {money(c.cost_per_hire_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        TaaSFlow proves the mix. Reply rate needs outreach timestamps; cost / hire needs
        source_cost_cents on applications. Fields are optional — the funnel works with whatever
        you tag.
      </p>
    </main>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "primary";
}) {
  return (
    <Card className={tone === "primary" ? "border-primary/40 bg-primary/5" : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
