import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Radar, ShieldAlert, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getOutreachOps, CHANNEL_LABEL, type OutreachChannel } from "@/lib/outreach.functions";
import { ChannelTileCard, CHANNEL_ICON, pct } from "@/components/outreach/channel-tile";

export const Route = createFileRoute("/_authenticated/admin/outreach")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["admin-outreach-ops"],
      queryFn: () => getOutreachOps({ data: {} }),
    }),
  head: () => ({
    meta: [
      { title: "Outreach ops · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed to load: {error.message}</div>
  ),
  component: AdminOutreachPage,
});

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  completed: "bg-primary/10 text-primary",
  archived: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function AdminOutreachPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-outreach-ops"],
    queryFn: () => getOutreachOps({ data: {} }),
  });
  const { tiles, campaigns, replies, health, health_rates } = data;

  const totalReplies =
    replies.interested + replies.not_interested + replies.future + replies.referral + replies.ooo + replies.unsub;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Radar className="h-3.5 w-3.5" />
            Ops surface
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Outreach engine — all clients</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Channel tiles, delivery health, and reply categories across every campaign. Clients see
            the summary; this view carries the operational depth.
          </p>
        </div>
      </header>

      {/* Delivery health */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <HealthKpi
          icon={CheckCircle2}
          label="Delivery rate"
          value={pct(health_rates.delivery)}
          tone={health_rates.delivery != null && health_rates.delivery >= 0.95 ? "good" : undefined}
        />
        <HealthKpi
          icon={AlertTriangle}
          label="Bounce rate"
          value={pct(health_rates.bounce)}
          tone={health_rates.bounce != null && health_rates.bounce > 0.05 ? "warn" : undefined}
        />
        <HealthKpi
          icon={ShieldAlert}
          label="Failed rate"
          value={pct(health_rates.failed)}
          tone={health_rates.failed != null && health_rates.failed > 0.02 ? "warn" : undefined}
        />
        <HealthKpi icon={Ban} label="Opt-out rate" value={pct(health_rates.opted_out)} />
        <HealthKpi icon={CheckCircle2} label="Touches sent" value={health.touches_sent.toLocaleString()} />
      </div>

      {/* Channel tiles */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <ChannelTileCard key={t.channel} tile={t} variant="admin" />
          ))}
        </div>
      </section>

      {/* Reply categories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reply categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <ReplyStat label="Interested" value={replies.interested} total={totalReplies} tone="good" />
            <ReplyStat label="Future" value={replies.future} total={totalReplies} />
            <ReplyStat label="Referral" value={replies.referral} total={totalReplies} />
            <ReplyStat label="Not interested" value={replies.not_interested} total={totalReplies} tone="muted" />
            <ReplyStat label="OOO" value={replies.ooo} total={totalReplies} tone="muted" />
            <ReplyStat label="Unsubscribe" value={replies.unsub} total={totalReplies} tone="warn" />
          </div>
        </CardContent>
      </Card>

      {/* Campaign list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active & recent campaigns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Channel</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Sent</th>
                  <th className="px-3 py-2 text-right font-medium">Delivered</th>
                  <th className="px-3 py-2 text-right font-medium">Replied</th>
                  <th className="px-3 py-2 text-right font-medium">Bounced</th>
                  <th className="px-3 py-2 text-right font-medium">Failed</th>
                  <th className="px-3 py-2 text-right font-medium">Opt-out</th>
                  <th className="px-3 py-2 text-right font-medium">Started</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      No campaigns yet. Once outreach lands, campaigns will appear here.
                    </td>
                  </tr>
                )}
                {campaigns.map((c: Record<string, unknown>) => {
                  const channel = c.channel as OutreachChannel;
                  const Icon = CHANNEL_ICON[channel] ?? CHANNEL_ICON.other;
                  const status = String(c.status ?? "draft");
                  return (
                    <tr key={String(c.id)} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-medium">{String(c.name ?? "—")}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          {CHANNEL_LABEL[channel] ?? channel}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className={`${STATUS_TONE[status] ?? STATUS_TONE.draft} border-0`}>
                          {status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(c.touches_sent ?? 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{Number(c.delivered ?? 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{Number(c.replied ?? 0)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                        {Number(c.bounced ?? 0) || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-destructive">
                        {Number(c.failed ?? 0) || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {Number(c.opted_out ?? 0) || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {c.started_at ? new Date(String(c.started_at)).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function HealthKpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const toneBorder =
    tone === "good"
      ? "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/20"
      : tone === "warn"
        ? "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20"
        : "";
  return (
    <Card className={toneBorder}>
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

function ReplyStat({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone?: "good" | "warn" | "muted";
}) {
  const share = total > 0 ? value / total : null;
  const toneCls =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  const barTone =
    tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-primary";
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneCls}`}>
        {value.toLocaleString()}
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${barTone} rounded-full`}
          style={{ width: `${share != null ? Math.min(100, share * 100) : 0}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">{pct(share)}</div>
    </div>
  );
}
