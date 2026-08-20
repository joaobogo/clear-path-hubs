// "…" overflow menu on the role detail header: pause the search, resume it, or
// archive the role. Written in the same voice as the "Not moving forward"
// dialog — say plainly what happens, then let the person decide.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setClientRoleState } from "@/lib/client/role-lifecycle.functions";

type State = "active" | "paused" | "archived";

const COPY: Record<
  Exclude<State, "active">,
  { title: string; description: string; confirmLabel: string; done: string }
> = {
  paused: {
    title: "Pause this search",
    description:
      "We stop sourcing for this role until you resume it. Candidates already delivered stay in your workspace.",
    confirmLabel: "Pause search",
    done: "Search paused",
  },
  archived: {
    title: "Archive this role",
    description:
      "We stop sourcing for this role. Candidates already delivered stay in your workspace.",
    confirmLabel: "Archive role",
    done: "Role archived",
  },
};

export function RoleLifecycleMenu({
  positionId,
  positionTitle,
  status,
  disabled,
  onChanged,
}: {
  positionId: string;
  positionTitle?: string | null;
  status: string;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const [pending, setPending] = useState<Exclude<State, "active"> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const setState = useServerFn(setClientRoleState);

  const mutation = useMutation({
    mutationFn: (v: { state: State }) => setState({ data: { positionId, state: v.state } }),
    onSuccess: (result, v) => {
      setPending(null);
      setFailure(null);
      void queryClient.invalidateQueries();
      onChanged?.();

      if (v.state === "active") {
        toast.success("Sourcing resumed for this role");
        return;
      }
      const previous = (result as { previousStatus?: string }).previousStatus;
      toast.success(COPY[v.state as Exclude<State, "active">].done, {
        action:
          previous && previous !== v.state
            ? {
                label: "Undo",
                onClick: () => mutation.mutate({ state: previous as State }),
              }
            : undefined,
      });
    },
    onError: (err: unknown) => {
      // The role stays exactly as it was — the change simply did not happen.
      setFailure(
        err instanceof Error && err.message
          ? "We couldn't change this role. Please try again."
          : "We couldn't change this role. Please try again.",
      );
    },
  });

  const isPaused = status === "paused";
  const isArchived = status === "archived" || status === "closed" || status === "filled";
  const busy = mutation.isPending;
  const copy = pending ? COPY[pending] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            aria-label="More actions for this role"
            data-qa-action="role-overflow-menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isPaused ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                mutation.mutate({ state: "active" });
              }}
              data-qa-action="role-resume"
            >
              Resume search
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={isArchived}
              onSelect={(e) => {
                e.preventDefault();
                setFailure(null);
                setPending("paused");
              }}
              data-qa-action="role-pause"
            >
              Pause search
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={status === "archived"}
            onSelect={(e) => {
              e.preventDefault();
              setFailure(null);
              setPending("archived");
            }}
            data-qa-action="role-archive"
          >
            Archive role
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (busy) return;
          if (!next) {
            setPending(null);
            setFailure(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>
              {positionTitle ? `${positionTitle}. ` : ""}
              {copy?.description}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            You can undo this straight away, or bring the role back later from your Roles list.
          </p>

          {failure && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
            >
              <p className="font-medium">Nothing changed — this didn't go through.</p>
              <p className="text-muted-foreground">{failure}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => pending && mutation.mutate({ state: pending })}
              data-qa-action="role-lifecycle-confirm"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {failure ? "Try again" : (copy?.confirmLabel ?? "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
