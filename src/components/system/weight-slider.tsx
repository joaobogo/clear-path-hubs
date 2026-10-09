import * as SliderPrimitive from "@radix-ui/react-slider";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Slider (The Run): 8 px track, 22 px thumb, the value shown at the right in
 * the wide width. It always shows its number, and whatever it drives updates
 * while dragging. Works by keyboard through the Radix primitive.
 */
export function WeightSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
  valueText,
  hint,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** How the number reads at the right. */
  format?: (v: number) => string;
  /** Spoken value, when the formatted one is not enough. */
  valueText?: string;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <label id={id} className="text-[15px] text-[color:var(--text,var(--ink))]">
          {label}
        </label>
        <output
          aria-live="off"
          className="wide num shrink-0 text-xl font-semibold text-[color:var(--action,var(--blue-600))]"
        >
          {format(value)}
        </output>
      </div>
      <SliderPrimitive.Root
        aria-labelledby={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v ?? value)}
        className="relative flex h-6 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-[color:var(--surface-2,var(--blue-100))]">
          <SliderPrimitive.Range className="absolute h-full bg-[color:var(--action,var(--blue-600))]" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-valuetext={valueText ?? format(value)}
          className="block h-[22px] w-[22px] rounded-full border-2 border-[color:var(--action,var(--blue-600))] bg-white focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)]"
        />
      </SliderPrimitive.Root>
      {hint ? <p className="text-sm text-[color:var(--text-3,var(--faint))]">{hint}</p> : null}
    </div>
  );
}
