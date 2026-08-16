// Lifecycle action bar for the position workspace (extracted from the route).
import { Fragment, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { setPositionStatus, setPositionVisibility } from "@/lib/admin.functions";
import { humanizePublishBlockedMessage } from "@/lib/publish-gate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// ── Lifecycle action bar (approve / activate / publish / pause / close / archive)
export function LifecycleBar({
  position,
  onDone,
  includeVisibilityCheck,
}: {
  position: Any;
  onDone: () => Promise<void>;
  includeVisibilityCheck?: boolean;
}) {
  const statusFn = useServerFn(setPositionStatus);
  const visibilityFn = useServerFn(setPositionVisibility);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<Any>, label: string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(`${label} · trace ${r.trace_id}`);
      await onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doStatus = (action: Any, label: string) =>
    run(() => statusFn({ data: { id: position.id, action } }), label);
  const doVis = (v: Any, label: string) =>
    run(() => visibilityFn({ data: { id: position.id, visibility: v } }), label);

  const s = position.status as string;
  const v = position.visibility as string;
  const isPublic = v === "public";

  type Action = { key: string; label: string; onClick: () => Promise<void>; variant?: Any };
  let primary: Action | null = null;
  const secondary: Action[] = [];

  if (s === "draft") {
    primary = { key: "submit", label: "Submit for review", onClick: () => doStatus("submit", "Submitted") };
  } else if (s === "submitted") {
    primary = { key: "start_review", label: "Start review", onClick: () => doStatus("start_review", "Under review") };
    secondary.push({ key: "approve", label: "Approve", onClick: () => doStatus("approve", "Approved") });
    secondary.push({ key: "clar", label: "Request clarification", onClick: () => doStatus("request_clarification", "Clarification requested") });
  } else if (s === "under_review") {
    primary = { key: "approve", label: "Approve", onClick: () => doStatus("approve", "Approved") };
    secondary.push({ key: "clar", label: "Request clarification", onClick: () => doStatus("request_clarification", "Clarification requested") });
  } else if (s === "needs_clarification") {
    primary = { key: "approve", label: "Approve", onClick: () => doStatus("approve", "Approved") };
    secondary.push({ key: "start_review", label: "Back to review", onClick: () => doStatus("start_review", "Under review") });
  } else if (s === "approved") {
    primary = { key: "activate", label: "Activate", onClick: () => doStatus("activate", "Activated") };
  } else if (s === "active") {
    primary = isPublic
      ? {
          key: "unpublish",
          label: "Unpublish",
          variant: "outline",
          onClick: () => doVis("private", "Removed from job board"),
        }
      : {
          key: "publish",
          label: "Publish",
          onClick: async () => {
            if (includeVisibilityCheck) {
              try {
                const { evaluatePublishGate } = await import("@/lib/publish-gate");
                const blockers = evaluatePublishGate({
                  status: position.status,
                  payment_status: position.payment_status,
                  approved_at: position.approved_at,
                  published_at: position.published_at,
                  title: position.title,
                  description: position.description,
                  employment_type: position.employment_type,
                  work_model: position.work_model,
                  seniority: position.seniority,
                  location: position.location,
                  requirements: position.requirements,
                }).filter((b) => b !== "not_approved");
                if (blockers.length > 0) {
                  const { publishBlockedMessage } = await import("@/lib/publish-gate");
                  toast.error(publishBlockedMessage(blockers));
                  return;
                }
              } catch (e) {
                console.error("Gate check failed", e);
              }
            }
            await doVis("public", "Live on job board");
          },
        };
    secondary.push({ key: "pause", label: "Pause", onClick: () => doStatus("pause", "Paused") });
    secondary.push({ key: "mark_filled", label: "Mark filled", onClick: () => doStatus("mark_filled", "Marked filled") });
    secondary.push({ key: "close", label: "Close", onClick: () => doStatus("close", "Closed") });
  } else if (s === "paused") {
    primary = { key: "resume", label: "Resume", onClick: () => doStatus("activate", "Resumed") };
    secondary.push({ key: "close", label: "Close", onClick: () => doStatus("close", "Closed") });
  } else if (s === "filled") {
    primary = { key: "reopen", label: "Reopen", onClick: () => doStatus("reopen", "Reopened") };
    secondary.push({ key: "close", label: "Close", onClick: () => doStatus("close", "Closed") });
  } else if (s === "closed") {
    primary = { key: "reopen", label: "Reopen", onClick: () => doStatus("reopen", "Reopened") };
    secondary.push({ key: "archive", label: "Archive", onClick: () => doStatus("archive", "Archived") });
  }

  if (s !== "archived" && s !== "closed") {
    if (!secondary.some((b) => b.key === "archive")) {
      secondary.push({ key: "archive", label: "Archive", onClick: () => doStatus("archive", "Archived") });
    }
  }

  return (
    <div className="flex items-center gap-2">
      {primary && (
        <Button
          size="sm"
          variant={primary.variant}
          disabled={busy}
          onClick={primary.onClick}
          data-qa-action={`position-${primary.key}`}
        >
          {primary.label}
        </Button>
      )}
      {secondary.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy} aria-label="More actions" data-qa-action="position-actions-menu">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {secondary.map((b, i) => (
              // Keyed fragment: a bare <> here triggers React's missing-key warning.
              <Fragment key={b.key}>
                {i > 0 && b.key === "archive" && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={b.onClick}
                  data-qa-action={`position-${b.key}`}
                  className={b.key === "archive" ? "text-destructive" : undefined}
                >
                  {b.label}
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

