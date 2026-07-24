import { Mail, Linkedin, Phone, MessageSquare, UserPlus, CalendarDays, Circle, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHANNEL_LABEL, type ChannelTile, type OutreachChannel } from "@/lib/outreach.functions";

export const CHANNEL_ICON: Record<OutreachChannel, LucideIcon> = {
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
  sms: MessageSquare,
  referral: UserPlus,
  event: CalendarDays,
  other: Circle,
};

export function pct(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(v < 0.1 ? Math.max(digits, 1) : digits)}%`;
}

export function ChannelTileCard({
  tile,
  variant = "client",
}: {
  tile: ChannelTile;
  variant?: "client" | "admin";
}) {
  const Icon = CHANNEL_ICON[tile.channel];
  const hasActivity = tile.touches_sent > 0 || tile.total_campaigns > 0;

  return (
    <Card className={hasActivity ? "" : "opacity-70"}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 text-primary p-1.5">
              <Icon className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm">{CHANNEL_LABEL[tile.channel]}</CardTitle>
          </div>
          {tile.active_campaigns > 0 ? (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-0 dark:bg-emerald-950/50 dark:text-emerald-300">
              {tile.active_campaigns} active
            </Badge>
          ) : tile.total_campaigns > 0 ? (
            <Badge variant="outline" className="text-muted-foreground">idle</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">—</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Touches" value={tile.touches_sent.toLocaleString()} />
          <Stat label="Reply rate" value={pct(tile.reply_rate)} tone={tile.reply_rate && tile.reply_rate >= 0.1 ? "good" : undefined} />
          <Stat label="Engaged" value={tile.engaged_candidates.toLocaleString()} />
          <Stat
            label={variant === "admin" ? "Bounce" : "Delivery"}
            value={variant === "admin" ? pct(tile.bounce_rate) : pct(tile.delivery_rate)}
            tone={variant === "admin"
              ? (tile.bounce_rate != null && tile.bounce_rate > 0.05 ? "warn" : undefined)
              : (tile.delivery_rate != null && tile.delivery_rate >= 0.95 ? "good" : undefined)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-400"
        : "";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}
