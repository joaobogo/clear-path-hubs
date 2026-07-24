import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, Users, MessageCircle, Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClientContext } from "@/lib/client.functions";
import { useClientOrgSearch } from "@/lib/use-client-org";
import { getOutreachSummary } from "@/lib/outreach.functions";
import { ChannelTileCard, pct } from "@/components/outreach/channel-tile";

export const Route = createFileRoute("/_authenticated/client/outreach")({
  head: () => ({
    meta: [
      { title: "Outreach engine · TaaSFlow" },
      {
        name: "description",
        content:
          "See how TaaSFlow reaches candidates across every channel — active campaigns, touches, reply rate, and engaged candidates.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Failed to load: {error.message}</div>
  ),
  component: ClientOutreachPage,
});

function ClientOutreachPage() {
  const orgSearch = useClientOrgSearch();
  const ctxFn = useServerFn(getClientContext);
  const summaryFn = useServerFn(getOutreachSummary);

  const { data: ctx } = useQuery({
    queryKey: ["client-context", orgSearch ?? null],
    queryFn: () => ctxFn({ data: orgSearch ? { orgId: orgSearch } : {} }),
  });
  const orgId = ctx?.active?.organization_id;

  const { data, isPending } = useQuery({
    queryKey: ["outreach-summary", orgId],
    queryFn: () => summaryFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  if (!orgId || isPending || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const { tiles, totals, reply_rate } = data;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Radar className="h-3.5 w-3.5" />
            Outreach engine
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Multi-channel outreach for your roles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            TaaSFlow works every channel that matters — email, LinkedIn, phone, referrals, and events —
            so your pipeline is not built on job ads alone.
          </p>
        </div>
      </header>

      {/* Top KPIs (client-safe) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Megaphone} label="Active campaigns" value={totals.active_campaigns.toLocaleString()} tone="primary" />
        <Kpi icon={MessageCircle} label="Touches" value={totals.touches_sent.toLocaleString()} />
        <Kpi icon={MessageCircle} label="Reply rate" value={pct(reply_rate)} />
        <Kpi icon={Users} label="Engaged candidates" value={totals.engaged_candidates.toLocaleString()} tone="primary" />
      </div>

      {/* Channel tiles */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <ChannelTileCard key={t.channel} tile={t} variant="client" />
          ))}
        </div>
      </section>

      {/* Positive response signal — client-safe reply distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Positive responses this cycle</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat label="Interested" value={totals.reply_interested} tone="good" />
            <MiniStat label="Open to future" value={totals.reply_future} />
            <MiniStat label="Engaged (all)" value={totals.engaged_candidates} tone="good" />
            <MiniStat label="Opted out" value={totals.opted_out} tone="muted" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Delivery and provider details live with your TaaSFlow team — surfaced above as reply
            rate and delivery percentage per channel so you see the outcome, not the plumbing.
          </p>
        </CardContent>
      </Card>
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

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "muted";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "muted"
        ? "text-muted-foreground"
        : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneCls}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
