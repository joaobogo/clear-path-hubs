// Lifecycle action bar for the position workspace (extracted from the route).
import { Fragment, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
import { useConfirmAction } from "@/components/ds/confirm-action";
import { getRequisitionQuality } from "@/lib/requisition.functions";
import { assessJobQuality, type QualityInput } from "@/lib/requisition-schema";
import { CLIENT_COPY } from "@/lib/events";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** The exact client-facing copy each lifecycle action delivers. */
const APPROVED_COPY = CLIENT_COPY["position_approved"] ?? {
  title: "Your role is approved",
  body: "We are preparing your position for launch.",
};
const CLARIFICATION_COPY = CLIENT_COPY["clarification_requested"] ?? {
  title: "We need a quick clarification",
  body: "Please review the open question on your role.",
};

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
  const { confirm, confirmDialog } = useConfirmAction();

  // Same query key and same pure assessment the readiness panel on this page
  // uses, so the bar can never disagree with the checklist above it.
  const loadQuality = useServerFn(getRequisitionQuality);
  const { data: quality } = useQuery({
    queryKey: ["requisition-quality", position.id],
    queryFn: () => loadQuality({ data: { id: position.id } }),
  });
  const readiness = useMemo(() => {
    if (!quality) return null;
    return assessJobQuality(quality.input as QualityInput);
  }, [quality]);
  const blockers = readiness?.blocking ?? [];

  const run = async (fn: () => Promise<Any>, label: string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(`${label} · trace ${r.trace_id}`);
      await onDone();
    } catch (e) {
      const msg = (e as Error).message || "";
      if (msg.startsWith("publish_blocked:")) {
        toast.error(humanizePublishBlockedMessage(msg));
      } else {
        toastError(e);
      }
    } finally {
      setBusy(false);
    }
  };

  const doStatus = (action: Any, label: string, reason?: string) =>
    run(() => statusFn({ data: { id: position.id, action, ...(reason ? { reason } : {}) } }), label);
  const doVis = (v: Any, label: string) =>
    run(() => visibilityFn({ data: { id: position.id, visibility: v } }), label);

  const roleName = position.title?.trim() || "This role";

  // ── Guarded actions ────────────────────────────────────────────────────────

  async function confirmStartReview() {
    const r = await confirm({
      title: "Start review",
      object: roleName,
      description:
        "This moves the requisition into review and tells the client their role is being looked at.",
      impact: [
        "Audience: everyone with access to this client workspace.",
        "This is a real notification, sent immediately.",
        "The role status changes from submitted to under review.",
        "You can move it back to review or request clarification afterwards.",
      ],
      confirmLabel: "Start review",
    });
    if (r.confirmed) await doStatus("start_review", "Under review");
  }

  async function confirmApprove() {
    if (blockers.length > 0) {
      toast.error(
        `Cannot approve yet — ${blockers.length} decision-critical item${blockers.length === 1 ? "" : "s"} missing: ${blockers
          .map((b) => b.label)
          .join(", ")}.`,
      );
      return;
    }
    const r = await confirm({
      title: "Approve this requisition",
      object: roleName,
      description:
        "Approving confirms the requisition is complete and ready to be activated.",
      impact: [
        "Audience: everyone with access to this client workspace.",
        "This is a real notification, sent immediately.",
        `Message title: “${APPROVED_COPY.title}”`,
        `Message body: “${APPROVED_COPY.body ?? ""}”`,
        "Approval is not final: you can send it back to review from the actions menu.",
      ],
      confirmLabel: "Approve role",
      reason: {
        label: "Approval note (kept on the audit trail)",
        placeholder: "Checked requirements, locations and seniority with the client.",
      },
    });
    if (r.confirmed) await doStatus("approve", "Approved", r.reason || undefined);
  }

  async function confirmClarification() {
    const r = await confirm({
      title: "Request clarification",
      object: roleName,
      description:
        "Your question is sent to the client and becomes the body of the notification they receive.",
      impact: [
        "Audience: everyone with access to this client workspace.",
        "This is a real notification, sent immediately.",
        `Message title: “${CLARIFICATION_COPY.title}”`,
        "Message body: the question you write below.",
        "The role moves to needs clarification until you move it back to review.",
      ],
      confirmLabel: "Send question",
      reason: {
        label: "What do you need the client to clarify?",
        placeholder: "Which seniority band is this role budgeted for, and is the location on-site?",
        required: true,
      },
    });
    if (r.confirmed) await doStatus("request_clarification", "Clarification requested", r.reason);
  }

  async function confirmReturnToReview() {
    const r = await confirm({
      title: "Return to review",
      object: roleName,
      description:
        "This removes the approval and puts the requisition back under review.",
      impact: [
        "The role status changes from approved back to under review.",
        "It cannot be activated or published until it is approved again.",
        "The client sees the role return to review in their workspace.",
      ],
      confirmLabel: "Return to review",
      tone: "destructive",
      reason: {
        label: "Why is the approval being withdrawn?",
        placeholder: "Approved before the location was confirmed.",
        required: true,
      },
    });
    if (r.confirmed) await doStatus("start_review", "Back under review", r.reason);
  }

  async function confirmArchive() {
    const r = await confirm({
      title: "Archive this role",
      object: roleName,
      description: "Archiving takes the role out of every active list and queue.",
      impact: [
        "The role stops appearing in active work queues.",
        "Candidates already in the pipeline stay on the record.",
      ],
      confirmLabel: "Archive role",
      tone: "destructive",
    });
    if (r.confirmed) await doStatus("archive", "Archived", r.reason || undefined);
  }

  const s = position.status as string;
  const v = position.visibility as string;
  const isPublic = v === "public";

  type Action = { key: string; label: string; onClick: () => Promise<void>; variant?: Any };
  let primary: Action | null = null;
  const secondary: Action[] = [];

  if (s === "draft") {
    primary = { key: "submit", label: "Submit for review", onClick: () => doStatus("submit", "Submitted") };
  } else if (s === "submitted") {
    primary = { key: "start_review", label: "Start review", onClick: confirmStartReview };
    secondary.push({ key: "approve", label: "Approve", onClick: confirmApprove });
    secondary.push({ key: "clar", label: "Request clarification", onClick: confirmClarification });
  } else if (s === "under_review") {
    primary = { key: "approve", label: "Approve", onClick: confirmApprove };
    secondary.push({ key: "clar", label: "Request clarification", onClick: confirmClarification });
  } else if (s === "needs_clarification") {
    primary = { key: "approve", label: "Approve", onClick: confirmApprove };
    secondary.push({ key: "start_review", label: "Back to review", onClick: () => doStatus("start_review", "Under review") });
  } else if (s === "approved") {
    primary = { key: "activate", label: "Activate", onClick: () => doStatus("activate", "Activated") };
    secondary.push({ key: "unapprove", label: "Return to review (un-approve)", onClick: confirmReturnToReview });
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
                const gateBlockers = evaluatePublishGate({
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
                if (gateBlockers.length > 0) {
                  const { publishBlockedMessage, humanizePublishBlockedMessage } = await import("@/lib/publish-gate");
                  toast.error(humanizePublishBlockedMessage(publishBlockedMessage(gateBlockers)));
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
    secondary.push({ key: "archive", label: "Archive", onClick: confirmArchive });
  }

  if (s !== "archived" && s !== "closed") {
    if (!secondary.some((b) => b.key === "archive")) {
      secondary.push({ key: "archive", label: "Archive", onClick: confirmArchive });
    }
  }

  const approveBlocked = blockers.length > 0;

  return (
    <div className="flex items-center gap-2">
      {primary && (
        <Button
          size="sm"
          variant={primary.variant}
          disabled={busy || (primary.key === "approve" && approveBlocked)}
          title={
            primary.key === "approve" && approveBlocked
              ? `Cannot approve yet — missing: ${blockers.map((b) => b.label).join(", ")}`
              : undefined
          }
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
                  disabled={b.key === "approve" && approveBlocked}
                  data-qa-action={`position-${b.key}`}
                  className={b.key === "archive" || b.key === "unapprove" ? "text-destructive" : undefined}
                >
                  {b.label}
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {confirmDialog}
    </div>
  );
}
