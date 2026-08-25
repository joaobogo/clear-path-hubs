// Archive / Delete controls for the client role editor. Without these a freshly
// created draft had no way out: only "Cancel" was offered.
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  archiveWorkspacePosition,
  deleteWorkspacePosition,
} from "@/lib/client-positions.functions";
import { toastError } from "@/lib/toast-error";
import { useHydrated } from "@/hooks/use-hydrated";

export function RoleEditorLifecycleActions({
  orgId,
  positionId,
  title,
  status,
}: {
  orgId: string;
  positionId: string;
  title: string;
  status: string;
}) {
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const archiveFn = useServerFn(archiveWorkspacePosition);
  const deleteFn = useServerFn(deleteWorkspacePosition);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isDraft = status === "draft";

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["client-positions"] });
    void queryClient.invalidateQueries({ queryKey: ["client-position", positionId] });
  };

  const archive = useMutation({
    mutationFn: () => archiveFn({ data: { orgId, positionId } }),
    onSuccess: () => {
      invalidate();
      toast.success(`“${title || "Untitled role"}” archived. You'll find it under Closed.`);
      void navigate({ to: "/client/positions", search: { status: "closed" } as never });
    },
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't archive this role. Nothing was changed." }),
  });

  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { orgId, positionId } }),
    onSuccess: () => {
      invalidate();
      setConfirmOpen(false);
      toast.success(`“${title || "Untitled role"}” deleted.`);
      void navigate({ to: "/client/positions", search: { status: "draft" } as never });
    },
    onError: (e: unknown) => {
      setConfirmOpen(false);
      toastError(e, { fallback: "We couldn't delete this role. Nothing was changed." });
    },
  });

  const busy = archive.isPending || remove.isPending;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => archive.mutate()}
        disabled={!hydrated || busy || status === "archived"}
      >
        {archive.isPending ? "Archiving…" : "Archive"}
      </Button>
      {isDraft && (
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={!hydrated || busy}
        >
          Delete
        </Button>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft role?</AlertDialogTitle>
            <AlertDialogDescription>
              “{title || "Untitled role"}” will be removed permanently. This cannot be
              undone. If you'd rather keep a record of it, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Keep the draft</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove.mutate();
              }}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
