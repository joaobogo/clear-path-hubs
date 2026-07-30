// Shared, client-safe lifecycle metadata for positions. No server imports —
// used by both the UI (to render valid controls) and the server functions.
export type LifecycleAction =
  | "submit"
  | "publish"
  | "pause"
  | "resume"
  | "close"
  | "reopen"
  | "archive";

export const LIFECYCLE_ACTIONS: Record<
  LifecycleAction,
  { from: string[]; to: string; label: string; verb: string; destructive?: boolean }
> = {
  submit: {
    from: ["draft", "needs_clarification"],
    to: "submitted",
    label: "Submitted for review",
    verb: "Submit for review",
  },
  publish: { from: ["approved"], to: "active", label: "Published", verb: "Publish position" },
  pause: { from: ["active"], to: "paused", label: "Paused", verb: "Pause sourcing" },
  resume: { from: ["paused"], to: "active", label: "Resumed", verb: "Resume sourcing" },
  close: {
    from: ["active", "paused", "filled"],
    to: "closed",
    label: "Closed",
    verb: "Close position",
    destructive: true,
  },
  reopen: { from: ["closed"], to: "active", label: "Reopened", verb: "Reopen position" },
  archive: {
    from: [
      "draft",
      "submitted",
      "under_review",
      "needs_clarification",
      "approved",
      "active",
      "paused",
      "filled",
      "closed",
    ],
    to: "archived",
    label: "Archived",
    verb: "Archive position",
    destructive: true,
  },
};

/** Actions the current status allows — used to render only valid controls. */
export function availableLifecycleActions(status: string): LifecycleAction[] {
  return (Object.keys(LIFECYCLE_ACTIONS) as LifecycleAction[]).filter((a) =>
    LIFECYCLE_ACTIONS[a].from.includes(status),
  );
}
