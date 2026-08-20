import * as React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ConfirmActionOptions = {
  /** Short, action-specific title. e.g. "Revoke share link". */
  title: string;
  /** The specific object the action applies to. e.g. a job title or person's name. */
  object?: string;
  /** One sentence describing what happens. */
  description: string;
  /** Concrete consequences, shown as a list. */
  impact?: string[];
  /** Label of the confirm button. Defaults to the title. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling + stronger copy. */
  tone?: "default" | "destructive";
  /**
   * Require the user to type this exact string. Reserve for truly
   * irreversible, high-impact actions (hard delete, account deletion).
   */
  typedConfirmation?: string;
  /** Capture a reason for the audit trail. */
  reason?: { label: string; placeholder?: string; required?: boolean };
};

export type ConfirmResult = { confirmed: boolean; reason: string };

type Pending = ConfirmActionOptions & {
  resolve: (result: ConfirmResult) => void;
};

/**
 * Accessible replacement for window.confirm(): focus trap + focus return,
 * Escape cancels without mutating, descriptive title, explicit consequences,
 * optional typed confirmation and audit reason.
 *
 * const { confirm, confirmDialog } = useConfirmAction();
 * ...
 * onClick={async () => { const r = await confirm({...}); if (r.confirmed) mutate(r.reason); }}
 * ...
 * {confirmDialog}
 */
export function useConfirmAction() {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const confirm = React.useCallback(
    (options: ConfirmActionOptions) =>
      new Promise<ConfirmResult>((resolve) => {
        setTyped("");
        setReason("");
        setTouched(false);
        setPending({ ...options, resolve });
      }),
    [],
  );

  const settle = React.useCallback(
    (confirmed: boolean) => {
      setPending((current) => {
        current?.resolve({ confirmed, reason: reason.trim() });
        return null;
      });
    },
    [reason],
  );

  const typedOk = !pending?.typedConfirmation || typed.trim() === pending.typedConfirmation;
  const reasonOk = !pending?.reason?.required || reason.trim().length > 0;
  const canConfirm = typedOk && reasonOk;

  const confirmDialog = (
    <AlertDialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
    >
      {pending ? (
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending.title}
              {pending.object ? (
                <span className="block text-sm font-normal text-muted-foreground">
                  {pending.object}
                </span>
              ) : null}
            </AlertDialogTitle>
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          </AlertDialogHeader>

          {pending.impact?.length ? (
            <ul className="list-disc space-y-1 rounded-md border bg-muted/40 p-3 pl-7 text-sm text-muted-foreground">
              {pending.impact.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          {pending.reason ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-reason">
                {pending.reason.label}{" "}
                <span className="text-xs text-muted-foreground">
                  {pending.reason.required ? "(required)" : "(optional)"}
                </span>
              </Label>
              <Textarea
                id="confirm-reason"
                rows={3}
                value={reason}
                placeholder={pending.reason.placeholder}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && !reasonOk}
              />
              {touched && !reasonOk ? (
                <p className="text-xs text-destructive">
                  A reason is required — it is stored on the audit trail.
                </p>
              ) : null}
            </div>
          ) : null}

          {pending.typedConfirmation ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-typed">
                Type <span className="font-mono font-semibold">{pending.typedConfirmation}</span> to
                confirm
              </Label>
              <Input
                id="confirm-typed"
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
                aria-invalid={typed.length > 0 && !typedOk}
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">
              {pending.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                (pending.tone === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 "
                  : "") + "min-h-11"
              }
              disabled={!canConfirm}
              title={
                canConfirm
                  ? undefined
                  : pending.typedConfirmation && !typedOk
                    ? `Type "${pending.typedConfirmation}" to enable this action`
                    : "Add a reason to enable this action"
              }
              onClick={(e) => {
                if (!canConfirm) {
                  e.preventDefault();
                  setTouched(true);
                  return;
                }
                settle(true);
              }}
            >
              {pending.confirmLabel ?? pending.title}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );

  return { confirm, confirmDialog };
}
