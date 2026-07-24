import type { JourneyEvent, JourneyEventKind } from "@/lib/journey.functions";
import {
  Send,
  Inbox,
  ScanText,
  Sparkles,
  Gauge,
  Eye,
  Star,
  Users,
  FileSignature,
  Trophy,
  XCircle,
  Undo2,
  RefreshCw,
  MailCheck,
  MailOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON: Record<JourneyEventKind, React.ComponentType<{ className?: string }>> = {
  sourced: Send,
  applied: Inbox,
  screened: ScanText,
  enriched: Sparkles,
  ranked: Gauge,
  delivered: Eye,
  shortlisted: Star,
  interviewed: Users,
  offer_sent: FileSignature,
  hired: Trophy,
  passed: XCircle,
  withdrawn: Undo2,
  rediscovered: RefreshCw,
  outreach_sent: MailCheck,
  outreach_replied: MailOpen,
};

const TONE_CLS: Record<JourneyEvent["tone"], string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-info/15 text-info ring-info/30",
  success: "bg-success/15 text-success ring-success/30",
  warning: "bg-warning/15 text-warning-foreground ring-warning/30",
  danger: "bg-destructive/15 text-destructive ring-destructive/30",
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function JourneyTimeline({
  events,
  emptyMessage = "No timeline events yet.",
  className,
}: {
  events: JourneyEvent[];
  emptyMessage?: string;
  className?: string;
}) {
  if (!events || events.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground", className)}>
        {emptyMessage}
      </div>
    );
  }
  return (
    <ol className={cn("relative space-y-4 pl-8", className)}>
      <span
        aria-hidden
        className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-border via-border/60 to-transparent"
      />
      {events.map((e, i) => {
        const Icon = ICON[e.kind];
        return (
          <li key={`${e.kind}-${e.at}-${i}`} className="relative">
            <span
              className={cn(
                "absolute -left-[26px] flex h-6 w-6 items-center justify-center rounded-full ring-2",
                TONE_CLS[e.tone],
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="rounded-md border bg-card px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{e.label}</span>
                <time className="text-xs text-muted-foreground tabular-nums">{fmt(e.at)}</time>
              </div>
              {e.detail ? (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{e.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
