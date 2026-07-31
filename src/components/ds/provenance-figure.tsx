import { useState } from "react";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { describeWindow, type Provenance } from "@/lib/provenance";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  provenance: Provenance;
  /** Optional short line under the value. */
  caption?: string;
  className?: string;
};

/**
 * A number a client can click to see exactly where it came from.
 * If you cannot supply provenance, do not render the number.
 */
export function ProvenanceFigure({
  label,
  value,
  provenance,
  caption,
  className,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label={`Where the ${label} figure comes from`}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 text-sm">
            <p className="font-medium">Where this comes from</p>
            <p className="mt-1 text-muted-foreground">{provenance.computed_from}</p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Records</dt>
                <dd className="font-medium tabular-nums">
                  {provenance.record_count.toLocaleString()}
                </dd>
              </div>
              {typeof provenance.closed_searches === "number" && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Closed searches</dt>
                  <dd className="font-medium tabular-nums">
                    {provenance.closed_searches.toLocaleString()}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Window</dt>
                <dd className="font-medium">{describeWindow(provenance)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Read from</dt>
                <dd className="text-right font-mono text-[11px] leading-relaxed">
                  {provenance.sources.join(", ")}
                </dd>
              </div>
            </dl>
          </PopoverContent>
        </Popover>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {caption && (
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      )}
    </div>
  );
}
