import { useEffect, useRef, useState } from "react";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Prompt 19 — a state-honest switch.
 *
 * Rules this component keeps:
 *  • On load it shows the real backend state, never a local guess.
 *  • While a change is in flight it shows a pending state and cannot be
 *    clicked again.
 *  • When the change lands it confirms briefly.
 *  • If it fails it rolls back visibly and says why, in plain words.
 *
 * There is no optimistic flip that silently reverts.
 */
export function HonestSwitch({
  checked,
  disabled,
  label,
  onCommit,
  className,
}: {
  /** The value the server currently holds. */
  checked: boolean;
  disabled?: boolean;
  label: string;
  /** Must resolve only once the server has confirmed the change. */
  onCommit: (next: boolean) => Promise<unknown>;
  className?: string;
}) {
  const [phase, setPhase] = useState<"idle" | "pending" | "confirmed" | "failed">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState<boolean | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handle(next: boolean) {
    if (phase === "pending") return;
    setAttempted(next);
    setPhase("pending");
    setError(null);
    try {
      await onCommit(next);
      setPhase("confirmed");
      timer.current = setTimeout(() => setPhase("idle"), 2000);
    } catch (e) {
      // Roll back visibly: the switch snaps back to the server's value.
      setPhase("failed");
      setError(
        e instanceof Error && e.message
          ? e.message
          : "That change did not save. Nothing was altered.",
      );
    } finally {
      setAttempted(null);
    }
  }

  // While pending we show what was asked for, marked as in flight. Every other
  // phase shows the server's value.
  const shown = phase === "pending" && attempted !== null ? attempted : checked;

  return (
    <div className={cn("flex flex-col items-end gap-1", className)}>
      <div className="flex items-center gap-2">
        {phase === "pending" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Saving
          </span>
        )}
        {phase === "confirmed" && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3 w-3" aria-hidden />
            Saved
          </span>
        )}
        <Switch
          checked={shown}
          disabled={disabled || phase === "pending"}
          onCheckedChange={handle}
          aria-label={label}
          aria-busy={phase === "pending"}
          data-phase={phase}
          className={cn(phase === "pending" && "opacity-70")}
        />
      </div>
      {phase === "failed" && error && (
        <p
          role="alert"
          className="flex max-w-64 items-start gap-1 text-right text-xs text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            {error} The switch is back where it was.
          </span>
        </p>
      )}
    </div>
  );
}
