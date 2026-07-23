import { useAnimatedNumber } from "@/lib/motion";

/**
 * Tweened numeric display for calculator outputs, score changes, and
 * metric callouts. Wraps a `<span>` so width can be reserved via
 * `tabular-nums` / `min-w-*` at the call site — prevents layout shift.
 *
 * Example:
 *   <AnimatedNumber value={monthlySavings} format={(n) => `$${Math.round(n).toLocaleString()}`} />
 */
export function AnimatedNumber({
  value,
  duration,
  format = (n) => Math.round(n).toLocaleString(),
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
  "aria-label"?: string;
}) {
  const tweened = useAnimatedNumber(value, { duration });
  return (
    <span
      className={className}
      style={{ fontVariantNumeric: "tabular-nums" }}
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {format(tweened)}
    </span>
  );
}
