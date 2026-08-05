import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { requestInterviewChange } from "@/lib/scheduling.functions";
import {
  CHANGE_COPY,
  CHANGE_ERROR_COPY,
  SHORT_NOTICE_NOTICE,
  changeEligibility,
  type InterviewChangeAction,
} from "@/lib/candidate/interview-change";

type Props = {
  interviewId: string;
  /** Booked start time. Null renders nothing — there is no interview to change. */
  scheduledAt: string | null;
  status: string;
  /** Application this interview belongs to, for cache invalidation. */
  applicationId?: string | null;
};

/**
 * Reschedule and cancel controls for a booked interview.
 *
 * Both actions live behind a confirmation sheet that is full-screen on mobile,
 * with the destructive action separated from the safe one. A failed request
 * leaves the interview exactly as it was and the message says so.
 */
export function InterviewChangeControls({
  interviewId,
  scheduledAt,
  status,
  applicationId,
}: Props) {
  const change = useServerFn(requestInterviewChange);
  const qc = useQueryClient();
  const [open, setOpen] = useState<InterviewChangeAction | null>(null);
  const [note, setNote] = useState("");

  const eligibility = changeEligibility({ scheduledAt, status });

  const mut = useMutation({
    mutationFn: (vars: { action: InterviewChangeAction; note?: string }) =>
      change({ data: { interviewId, action: vars.action, note: vars.note } }),
    onSuccess: (_r, vars) => {
      toast.success(CHANGE_COPY[vars.action].success);
      setOpen(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["me-interviews"] });
      qc.invalidateQueries({ queryKey: ["me-dashboard"] });
      if (applicationId) {
        qc.invalidateQueries({ queryKey: ["me-application", applicationId] });
      }
    },
    onError: (e: unknown, vars) => {
      const msg = e instanceof Error ? e.message.replace(/^Error: /, "") : "";
      toast.error(CHANGE_ERROR_COPY[msg] ?? CHANGE_COPY[vars.action].failure);
    },
  });

  // Empty state: no controls before an interview exists.
  if (!eligibility.allowed) {
    return eligibility.blockedReason ? (
      <p className="mt-3 text-xs text-muted-foreground">{eligibility.blockedReason}</p>
    ) : null;
  }

  const copy = open ? CHANGE_COPY[open] : null;
  const busy = mut.isPending;

  return (
    <>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={busy}
          onClick={() => {
            setNote("");
            setOpen("reschedule");
          }}
        >
          <CalendarClock className="h-4 w-4" />
          <span>{CHANGE_COPY.reschedule.trigger}</span>
        </Button>
        <Button
          variant="ghost"
          className="min-h-11 w-full text-muted-foreground sm:w-auto"
          disabled={busy}
          onClick={() => {
            setNote("");
            setOpen("cancel");
          }}
        >
          <X className="h-4 w-4" />
          <span>{CHANGE_COPY.cancel.trigger}</span>
        </Button>
      </div>
      {eligibility.shortNotice ? (
        <p className="mt-2 text-xs text-muted-foreground">{SHORT_NOTICE_NOTICE}</p>
      ) : null}

      <Sheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next && !busy) setOpen(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="flex h-[100dvh] flex-col gap-0 overflow-y-auto rounded-none sm:h-auto sm:max-h-[85vh] sm:rounded-t-2xl"
        >
          {copy ? (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{copy.title}</SheetTitle>
                <SheetDescription>{copy.whatHappens}</SheetDescription>
              </SheetHeader>

              {eligibility.shortNotice ? (
                <p className="mt-4 rounded-lg border bg-muted/50 p-3 text-sm">
                  {SHORT_NOTICE_NOTICE}
                </p>
              ) : null}

              <div className="mt-4 space-y-2">
                <label
                  className="block text-xs text-muted-foreground"
                  htmlFor={`change-note-${interviewId}`}
                >
                  {copy.noteLabel}
                </label>
                <textarea
                  id={`change-note-${interviewId}`}
                  value={note}
                  rows={3}
                  maxLength={1000}
                  placeholder={copy.notePlaceholder}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-md border bg-background p-2 text-sm placeholder:text-muted-foreground"
                />
              </div>

              {/* Safe action first and visually separated from the destructive one. */}
              <div className="mt-auto flex flex-col gap-3 pt-6">
                <Button
                  variant="outline"
                  className="min-h-11 w-full"
                  disabled={busy}
                  onClick={() => setOpen(null)}
                >
                  Keep this interview
                </Button>
                <div className="border-t pt-3">
                  <Button
                    variant={open === "cancel" ? "destructive" : "default"}
                    className="min-h-11 w-full"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => mut.mutate({ action: open, note: note.trim() || undefined })}
                  >
                    {busy ? copy.pending : copy.confirm}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
