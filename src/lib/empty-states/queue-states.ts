/**
 * Queue state variants.
 *
 * Every staff queue must distinguish three different zeros:
 *   - empty    → there is genuinely nothing to do
 *   - filtered → candidates exist but the current filters hide them
 *   - error    → we could not load, so we do not know
 * Showing "nothing to do" when a load failed is a correctness bug, not a
 * cosmetic one, so queues resolve their zero through this module.
 */
import type { SurfaceStateContent } from "./empty-state-catalogue";
import { resolveFilteredEmptyState } from "./empty-state-catalogue";

export type QueueVariant = "empty" | "filtered" | "error";

export function resolveQueueVariant(args: {
  isError: boolean;
  rowCount: number;
  activeFilters: string[];
}): QueueVariant | null {
  if (args.isError) return "error";
  if (args.rowCount > 0) return null;
  return args.activeFilters.length > 0 ? "filtered" : "empty";
}

export function resolveQueueState(args: {
  variant: QueueVariant;
  queueLabel: string;
  /** What puts work into this queue. */
  populates: string;
  activeFilters?: string[];
  errorMessage?: string | null;
  retryLabel?: string;
}): SurfaceStateContent {
  if (args.variant === "filtered") {
    return resolveFilteredEmptyState(args.activeFilters ?? []);
  }
  if (args.variant === "error") {
    return {
      id: "queue-error",
      icon: "filters",
      tone: "attention",
      title: `${args.queueLabel} could not be loaded`,
      why:
        args.errorMessage?.trim()
          ? `The request failed: ${args.errorMessage.trim()}`
          : "The request for this queue failed, so we cannot say whether there is work here.",
      expected: "Not expected — this is a load failure, not an empty queue.",
      populates: "Retrying reloads the queue from source records.",
      activity: "Nothing is running — the last load failed and stopped.",
      action: { label: args.retryLabel ?? "Try again" },
    };
  }
  return {
    id: "queue-empty",
    icon: "approvals",
    tone: "expected",
    title: `Nothing in ${args.queueLabel.toLowerCase()}`,
    why: "Every record that would appear here has been handled.",
    expected: "Expected — there is nothing outstanding.",
    populates: args.populates,
    activity: "Nothing is running for this queue right now.",
  };
}
