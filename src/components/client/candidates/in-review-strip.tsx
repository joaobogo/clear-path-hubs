/**
 * "N applications are still being read" — stated on the candidates page even
 * when the list is NOT empty.
 *
 * The empty-state catalogue already says this, but it only ever renders when
 * there are zero rows to show. A workspace with one delivered candidate and
 * eleven applications in review therefore read as "1 candidate" and nothing
 * else: the eleven were invisible, and the client had no way to know more was
 * coming (audit #4, item 49).
 */
import { Loader2 } from "lucide-react";
import { useEmptyStateSignalsQuery } from "@/hooks/use-empty-state-signals";

export function InReviewStrip({
  orgId,
  positionId,
}: {
  orgId: string | undefined;
  /** When the list is filtered to one role, the count is scoped to that role. */
  positionId?: string;
}) {
  const { signals, resolved } = useEmptyStateSignalsQuery(orgId, {
    enabled: Boolean(orgId),
    ...(positionId ? { positionId } : {}),
  });

  // Never guess a number: nothing is claimed until the signals resolve.
  if (!resolved || !signals) return null;
  const count = signals.inProcessing ?? 0;
  if (count <= 0) return null;

  return (
    <div
      data-testid="candidates-in-review"
      className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
    >
      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">
          {count} more application{count === 1 ? "" : "s"} {count === 1 ? "is" : "are"} still being
          read and assessed.
        </span>{" "}
        They appear here once the assessment is complete — nothing is needed from you.
      </p>
    </div>
  );
}
