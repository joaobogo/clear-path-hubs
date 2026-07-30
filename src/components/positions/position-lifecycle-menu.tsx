import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirmAction } from "@/components/ds";
import { MoreHorizontal, Copy } from "lucide-react";
import {
  availableLifecycleActions,
  LIFECYCLE_ACTIONS,
  type LifecycleAction,
} from "@/lib/position-lifecycle";
import { setPositionLifecycle, duplicatePosition } from "@/lib/position-lifecycle.functions";

/**
 * Lifecycle menu for a position: publish, pause, resume, close, reopen,
 * archive and duplicate. Only transitions the current status actually
 * permits are rendered, and destructive ones require a confirmation with an
 * audit reason.
 */
export function PositionLifecycleMenu({
  positionId,
  status,
  title,
  disabled,
  onChanged,
  editRoute = "/client/positions/$id/edit",
}: {
  positionId: string;
  status: string;
  title: string;
  disabled?: boolean;
  onChanged?: () => void;
  editRoute?: "/client/positions/$id/edit" | "/admin/positions/$id/edit";
}) {
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirmAction();
  const lifecycleFn = useServerFn(setPositionLifecycle);
  const duplicateFn = useServerFn(duplicatePosition);

  const transition = useMutation({
    mutationFn: (v: { action: LifecycleAction; reason?: string }) =>
      lifecycleFn({ data: { positionId, action: v.action, reason: v.reason } }),
    onSuccess: (r) => {
      toast.success(`${r.label}.`);
      onChanged?.();
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error && e.message.startsWith("invalid_transition")
          ? "This position has already moved on. Refresh to see its current state."
          : "We couldn't update this position. Please try again.",
      ),
  });

  const duplicate = useMutation({
    mutationFn: () => duplicateFn({ data: { positionId } }),
    onSuccess: (r) => {
      toast.success(`Copied to a new draft: ${r.title}`);
      void navigate({ to: editRoute, params: { id: r.id }, search: { step: undefined } as never });
    },
    onError: () => toast.error("We couldn't duplicate this position. Please try again."),
  });

  const actions = availableLifecycleActions(status);
  const busy = transition.isPending || duplicate.isPending;

  async function run(action: LifecycleAction) {
    const rule = LIFECYCLE_ACTIONS[action];
    if (rule.destructive) {
      const result = await confirm({
        title: rule.verb,
        object: title,
        description:
          action === "close"
            ? "Sourcing stops and the job is removed from the public board. You can reopen it later."
            : "The position is archived and becomes read-only. This cannot be undone.",
        impact:
          action === "close"
            ? ["Candidate discovery stops", "The public job post is withdrawn", "Existing candidates stay in your pipeline"]
            : ["No further status changes are possible", "The record stays available for reporting"],
        tone: "destructive",
        confirmLabel: rule.verb,
        reason: { label: "Reason (recorded in the audit trail)", required: action === "archive" },
      });
      if (!result.confirmed) return;
      transition.mutate({ action, reason: result.reason || undefined });
      return;
    }
    transition.mutate({ action });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled || busy}>
            <MoreHorizontal className="mr-1.5 h-4 w-4" />
            Manage
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Position lifecycle
          </DropdownMenuLabel>
          {actions.length === 0 ? (
            <DropdownMenuItem disabled>No status changes available</DropdownMenuItem>
          ) : (
            actions.map((a) => (
              <DropdownMenuItem
                key={a}
                onSelect={(e) => {
                  e.preventDefault();
                  void run(a);
                }}
                className={LIFECYCLE_ACTIONS[a].destructive ? "text-destructive" : undefined}
                data-qa-action={`position-${a}`}
              >
                {LIFECYCLE_ACTIONS[a].verb}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              duplicate.mutate();
            }}
            data-qa-action="position-duplicate"
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate as new draft
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDialog}
    </>
  );
}
