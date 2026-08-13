import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Wrench, Clock } from "lucide-react";

import { getPlatformStatus } from "@/lib/status/platform-status.functions";
import { degradedNotice } from "@/lib/status/platform-status";
import { cn } from "@/lib/utils";

/**
 * In-product degraded-mode banner.
 *
 * Shown only when a measurement says something is disrupted or deliberately
 * paused. It states what may be delayed or unavailable and what is safe, so a
 * user can tell "wait" apart from "something I did went wrong". It never
 * appears speculatively and never blocks the page.
 */
export function DegradedModeBanner({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["platform-status", "banner"],
    queryFn: () => getPlatformStatus(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  });

  const notice = degradedNotice(data);
  if (!notice.show) return null;

  const maintenance = notice.status === "maintenance";
  const Icon = maintenance ? Wrench : AlertTriangle;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-start sm:gap-3",
        maintenance
          ? "border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/[0.04]"
          : "border-warning/30 bg-warning/[0.07]",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          maintenance ? "text-[color:var(--brand-navy)]/70" : "text-warning-strong",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[color:var(--brand-navy)]">{notice.title}</p>
        <p className="mt-0.5 text-sm text-[color:var(--brand-navy)]/75">{notice.body}</p>
        {data ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--brand-navy)]/70">
            <Clock className="h-3 w-3" aria-hidden />
            Checked {new Date(data.checked_at).toLocaleTimeString()}
          </p>
        ) : null}
      </div>
      <Link
        to="/status"
        className="shrink-0 self-start rounded-md border border-[color:var(--brand-navy)]/15 px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-navy)] transition-colors hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
      >
        System status
      </Link>
    </div>
  );
}
