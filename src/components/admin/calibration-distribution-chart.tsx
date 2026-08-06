/**
 * Live score distribution against the band boundaries.
 *
 * The point of this chart is to make range compression obvious: bars show
 * where scores actually land, shaded lanes show where each band starts, and
 * any band lane with no bar under it is called out as never produced.
 */
import type { CalibrationDesk } from "@/lib/scoring/calibration-desk";
import { cn } from "@/lib/utils";

export function CalibrationDistributionChart({ desk }: { desk: CalibrationDesk }) {
  const maxCount = Math.max(1, ...desk.buckets.map((b) => b.count));

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-40" role="img" aria-label="Score distribution by band">
        {desk.buckets.map((bucket) => {
          const height = (bucket.count / maxCount) * 100;
          const reached =
            desk.range.observed_max !== null && bucket.from <= desk.range.observed_max;
          return (
            <div key={`${bucket.from}-${bucket.to}`} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {bucket.count || ""}
              </span>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={cn(
                    "w-full rounded-t transition-all",
                    bucket.count > 0 ? "bg-primary" : reached ? "bg-muted" : "bg-muted/40",
                  )}
                  style={{ height: `${Math.max(bucket.count > 0 ? 4 : 1, height)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">{bucket.from}</span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {desk.band_performance.map((band) => (
          <div
            key={band.band}
            className={cn(
              "rounded-md border px-2 py-1 text-xs",
              band.never_produced
                ? "border-dashed text-muted-foreground"
                : band.never_converts
                  ? "border-destructive/50 text-destructive"
                  : "border-border",
            )}
          >
            <span className="font-medium">{band.label}</span>{" "}
            <span className="tabular-nums text-muted-foreground">
              {band.min}–{band.max}
            </span>
            <span className="block text-[11px] text-muted-foreground">{band.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
