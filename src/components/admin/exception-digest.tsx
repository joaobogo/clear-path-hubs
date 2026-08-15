/**
 * Persistent exception counter for the admin shell header.
 *
 * Counts are the same numbers the source screens show. A failed read renders
 * as "Status unavailable" — never as zero exceptions. Dismissal lasts for the
 * browser session only; no toasts, no browser notifications, no sound.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Check, X } from "lucide-react";
import { getExceptionDigest } from "@/lib/exception-digest.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

const DISMISS_KEY = "taasflow:admin:exception-digest:dismissed";
const REFRESH_MS = 60_000;

export function ExceptionDigest() {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fetchDigest = useServerFn(getExceptionDigest);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const q = useQuery({
    queryKey: ["admin", "exception-digest"],
    queryFn: () => fetchDigest(),
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  // Refreshed on navigation as well as on the interval.
  useEffect(() => {
    if (!dismissed) void q.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (dismissed) return null;

  const entries = q.data?.entries ?? [];
  const anyUnavailable = q.isError || entries.some((e) => e.status === "unavailable");
  const total = entries.reduce((sum, e) => sum + (e.count ?? 0), 0);
  const known = entries.filter((e) => e.status === "ok");

  let label: string;
  let tone: "neutral" | "clear" | "alert";
  if (q.isPending) {
    label = "Exceptions";
    tone = "neutral";
  } else if (q.isError) {
    label = "Status unavailable";
    tone = "neutral";
  } else if (total > 0) {
    label = String(total);
    tone = "alert";
  } else if (anyUnavailable) {
    label = "Status partly unavailable";
    tone = "neutral";
  } else {
    label = "All clear";
    tone = "clear";
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open exception digest"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
            tone === "alert" && "border-destructive/40 bg-destructive/10 text-destructive",
            tone === "clear" && "border-border bg-card text-muted-foreground",
            tone === "neutral" && "border-border bg-card text-muted-foreground",
          )}
        >
          {tone === "clear" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          <span className={cn(q.isPending && "opacity-60")}>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Exceptions</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={() => {
              try {
                sessionStorage.setItem(DISMISS_KEY, "1");
              } catch {
                /* ignore */
              }
              setDismissed(true);
              setOpen(false);
            }}
          >
            <X className="h-3 w-3" /> Dismiss for this session
          </Button>
        </div>

        <div className="p-2">
          <PanelState
            query={q}
            skeletonRows={5}
            isEmpty={known.length > 0 && total === 0 && !anyUnavailable}
            empty={<PanelEmpty className="border-none p-0 py-3" title="All clear" />}
          >
            <ul className="space-y-0.5">
              {entries.map((e) => (
                <li key={e.key}>
                  <Link
                    to={e.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className="truncate">{e.label}</span>
                    {e.status === "unavailable" ? (
                      <span className="shrink-0 text-xs text-muted-foreground">Unavailable</span>
                    ) : (
                      <span
                        className={cn(
                          "shrink-0 tabular-nums text-sm font-semibold",
                          (e.count ?? 0) > 0 ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {e.count}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </PanelState>
        </div>

        {q.data ? (
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            Updated {new Date(q.data.generated_at).toLocaleTimeString(APP_LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })} · refreshes every minute
            and on navigation
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
