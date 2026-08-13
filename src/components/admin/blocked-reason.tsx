/**
 * The one way a staff queue says "you cannot do this yet".
 *
 * A disabled button with a tooltip is a dead end: the reason is invisible until
 * hover and there is nowhere to go. This always states the reason in text and
 * offers the route that clears it.
 */
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function BlockedReason({
  reasons,
  resolve,
  className,
}: {
  reasons: string[];
  /** Where the blocker gets cleared — never leave the row without an exit. */
  resolve?: { to: string; params?: Record<string, string>; label: string };
  className?: string;
}) {
  if (reasons.length === 0) return null;
  return (
    <div
      className={cn(
        "rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-left",
        className,
      )}
    >
      <p className="flex items-start gap-1.5 text-[11px] font-medium text-destructive">
        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>Blocked — {reasons.length === 1 ? "1 reason" : `${reasons.length} reasons`}</span>
      </p>
      <ul className="mt-1 space-y-0.5 pl-4 text-[11px] text-destructive">
        {reasons.map((r) => (
          <li key={r} className="list-disc">
            {r}
          </li>
        ))}
      </ul>
      {resolve ? (
        <Link
          to={resolve.to}
          params={resolve.params as never}
          className="mt-1.5 inline-block text-[11px] font-medium text-primary underline underline-offset-2"
        >
          {resolve.label} →
        </Link>
      ) : null}
    </div>
  );
}
