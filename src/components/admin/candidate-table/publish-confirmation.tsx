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

export function PublishConfirmation({
  open,
  onOpenChange,
  onConfirm,
  count,
  isBlocking = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  count: number;
  isBlocking?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBlocking ? "This record is not approved for publishing" : "Confirm publishing"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBlocking
              ? `This row is marked as not approved for publishing. Publishing it anyway will make ${count} candidate(s) visible to the client immediately.`
              : `This will make ${count} candidate(s) visible to the client immediately. This is a real notification, sent now.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={isBlocking ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {isBlocking ? "Publish anyway" : "Publish now"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
