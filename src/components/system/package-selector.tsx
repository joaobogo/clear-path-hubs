import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * PackageSelector (The Run): the one control on Pricing. Seven stops in
 * blue: 1, 10, 20, 30, 40, 100 and 100+. It replaces the plan cards and the
 * larger-packages table; the receipt and the entitlement table follow it.
 */
export type PackageStop = { id: string; roles: number | null; label: string; short: string };

export function PackageSelector({
  stops,
  value,
  onChange,
  className,
}: {
  stops: readonly PackageStop[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p id={id} className="text-[15px] text-[color:var(--slate)]">
        How many roles do you have open?
      </p>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-2">
        {stops.map((s) => {
          const selected = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={s.label}
              onClick={() => onChange(s.id)}
              className={cn(
                "wide num inline-flex min-h-[52px] min-w-[64px] items-center justify-center rounded-[var(--r-1)] border px-4 text-lg font-semibold",
                "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)]",
                selected
                  ? "border-[color:var(--blue-600)] bg-[color:var(--blue-600)] text-white"
                  : "border-[color:var(--rule-2)] bg-white text-[color:var(--ink)] hover:border-[color:var(--blue-600)] hover:text-[color:var(--blue-600)]",
              )}
            >
              {s.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}
