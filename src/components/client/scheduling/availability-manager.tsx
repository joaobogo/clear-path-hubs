import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { zoneDisplay } from "@/lib/time/zone-label";
import {
  getAvailabilityWindows,
  saveAvailabilityWindows,
} from "@/lib/availability.functions";
import {
  WEEKDAY_LABELS,
  defaultWindows,
  describeWindow,
  labelToMinutes,
  minutesToLabel,
  type AvailabilityWindow,
} from "@/lib/availability";
import { viewerTimezone } from "@/lib/scheduling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarRange, Check, Pencil, Plus, Trash2 } from "lucide-react";

/** Stable identity for a saved window, so a chip can point at its editor row. */
const windowKey = (w: AvailabilityWindow) =>
  `${w.weekday}-${w.start_minute}-${w.end_minute}`;

export function useAvailability(orgId: string | undefined) {
  const fn = useServerFn(getAvailabilityWindows);
  return useQuery({
    queryKey: ["org-availability", orgId],
    queryFn: () => fn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });
}

/** Client sets its interview availability once; every proposal reuses it. */
export function AvailabilityManager({
  orgId,
  readOnly,
}: {
  orgId: string;
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const query = useAvailability(orgId);
  const saveFn = useServerFn(saveAvailabilityWindows);
  const [open, setOpen] = useState(false);
  // Set when the editor is opened by clicking one day chip: that window's
  // start time gets focus so the chip behaves like a time-range control.
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const startRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [timezone, setTimezone] = useState(viewerTimezone());
  const [rows, setRows] = useState<AvailabilityWindow[]>([]);

  const saved = useMemo(
    () => (query.data?.windows ?? []) as AvailabilityWindow[],
    [query.data],
  );

  const openEditor = useCallback((key: string | null) => {
    setFocusKey(key);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const tz = query.data?.timezone || viewerTimezone();
    setTimezone(tz);
    setRows(saved.length > 0 ? saved.map((w) => ({ ...w })) : defaultWindows(tz));
  }, [open, saved, query.data?.timezone]);

  useEffect(() => {
    if (!open || !focusKey) return;
    const t = window.setTimeout(() => {
      startRefs.current[focusKey]?.focus();
      startRefs.current[focusKey]?.select?.();
    }, 60);
    return () => window.clearTimeout(t);
  }, [open, focusKey, rows.length]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          orgId,
          timezone,
          windows: rows.map((r) => ({
            weekday: r.weekday,
            start_minute: r.start_minute,
            end_minute: r.end_minute,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Availability updated — the TaaSFlow team has been notified.");
      qc.invalidateQueries({ queryKey: ["org-availability"] });
      setFocusKey(null);
      setOpen(false);
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "invalid_window_range"
          ? "End time must be after start time."
          : e.message === "forbidden"
            ? "You don't have permission to change availability."
            : e.message,
      ),
  });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarRange className="h-4 w-4 text-primary" />
            Your interview availability
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {query.isError
              ? "We couldn't load your saved windows. This is a loading problem, not an empty schedule — reload before you change anything."
              : query.isPending
                ? "Loading your saved windows…"
                : saved.length === 0
                  ? "Set your windows once — candidates then pick from them, no back-and-forth."
                  : `Candidates choose from these windows (${zoneDisplay(query.data?.timezone ?? "UTC")}).`}
          </p>

          {saved.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {saved.map((w, i) =>
                readOnly ? (
                  <Badge key={w.id ?? i} variant="outline" className="font-normal">
                    {describeWindow(w)}
                  </Badge>
                ) : (
                  <button
                    key={w.id ?? i}
                    type="button"
                    onClick={() => openEditor(windowKey(w))}
                    aria-label={`Change the time range for ${describeWindow(w)}`}
                    className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-normal text-foreground transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>*]:pointer-events-none"
                  >
                    <span>{describeWindow(w)}</span>
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                ),
              )}
            </div>
          ) : null}
          {!readOnly && saved.length > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Click a day to change its hours.
            </p>
          ) : null}
        </div>
        {!readOnly ? (
          <Button
            variant={saved.length === 0 ? "default" : "outline"}
            disabled={query.isError || query.isPending}
            onClick={() => openEditor(null)}
          >
            {query.isError ? "Unavailable" : saved.length === 0 ? "Set availability" : "Edit windows"}
          </Button>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setFocusKey(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Interview availability</DialogTitle>
            <DialogDescription>
              Weekly windows in {timezone}. We generate candidate options from these.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">Timezone</span>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1"
                placeholder="Europe/London"
              />
            </label>

            <div className="space-y-2">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex"
                >
                  <select
                    className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
                    value={r.weekday}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, weekday: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  >
                    {WEEKDAY_LABELS.map((d, idx) => (
                      <option key={d} value={idx}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="time"
                    ref={(el) => {
                      startRefs.current[windowKey(r)] = el;
                    }}
                    aria-label={`Start time on ${WEEKDAY_LABELS[r.weekday]}`}
                    className={
                      focusKey === windowKey(r)
                        ? "w-28 ring-2 ring-primary ring-offset-1"
                        : "w-28"
                    }
                    value={minutesToLabel(r.start_minute)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, start_minute: labelToMinutes(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    type="time"
                    aria-label={`End time on ${WEEKDAY_LABELS[r.weekday]}`}
                    className="w-28"
                    value={minutesToLabel(r.end_minute)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, end_minute: labelToMinutes(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    aria-label={`Remove availability window on ${WEEKDAY_LABELS[r.weekday]} at ${minutesToLabel(r.start_minute)}`}
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No windows yet — add at least one.
                </p>
              ) : null}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { weekday: 1, start_minute: 9 * 60, end_minute: 17 * 60, timezone },
                ])
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add window
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setFocusKey(null);
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Check className="mr-1.5 h-4 w-4" />
              {saveMut.isPending ? "Updating…" : "Update availability"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
