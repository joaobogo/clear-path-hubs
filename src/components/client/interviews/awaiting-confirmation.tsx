import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { formatDateTime, pluralize } from "@/lib/format/datetime";
import { interviewsAwaitingConfirmation } from "@/lib/client/interviews-to-confirm";
import { liveSlots } from "@/lib/scheduling";
import { currentInterviewRecords } from "@/lib/client/interview-buckets";
import type { InterviewDTO } from "@/lib/interviews.functions";

/**
 * "Waiting on you to confirm a time" — the top block of the Interviews page.
 * Reads the same definition as the home page rows and the Roles page banner.
 */
export function AwaitingConfirmationSection({
  interviews,
  readOnly,
  onConfirm,
  onSendNewTimes,
  busyId,
}: {
  interviews: InterviewDTO[];
  readOnly: boolean;
  onConfirm: (interview: InterviewDTO) => void;
  onSendNewTimes?: (interview: InterviewDTO) => void;
  busyId?: string | null;
}) {
  // One row per candidate match — the same reconciled records the timeline
  // below reads, so the heading count and the list can never disagree.
  const pending = interviewsAwaitingConfirmation(currentInterviewRecords(interviews));
  if (pending.length === 0) return null;

  return (
    <section aria-labelledby="awaiting-confirmation-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="awaiting-confirmation-heading" className="text-lg font-semibold">
          Waiting on you to confirm a time
        </h2>
        <span className="text-sm text-muted-foreground">
          {pluralize(pending.length, "interview")}
        </span>
      </div>
      <div className="space-y-2">
        {pending.map((iv) => {
          // Same list the timeline card reads: expired windows and times that
          // have already passed are not options the client can still confirm.
          const slots = liveSlots(iv.proposed_times ?? [], iv.availability_expires_at).slice().sort();
          const earliest = slots[0] ?? null;
          return (
            <Card
              key={iv.id}
              id={`awaiting-${iv.id}`}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {iv.candidate?.name ?? "Candidate"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {iv.position?.title ?? "Your role"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  {slots.length > 0 && earliest
                    ? `${pluralize(slots.length, "proposed time")} · earliest ${formatDateTime(earliest)}`
                    : "No times still available — we will send new ones"}
                </p>
              </div>
              {/* The button matches the slots: nothing to confirm when every
                  proposed time has lapsed, so the action becomes sending new
                  ones instead of opening an empty picker. */}
              {!readOnly ? (
                slots.length > 0 ? (
                  <Button onClick={() => onConfirm(iv)} className="sm:shrink-0">
                    Confirm a time
                  </Button>
                ) : onSendNewTimes ? (
                  <Button
                    variant="secondary"
                    className="sm:shrink-0"
                    disabled={busyId === iv.id}
                    onClick={() => onSendNewTimes(iv)}
                  >
                    {busyId === iv.id ? "Sending…" : "Send new times"}
                  </Button>
                ) : null
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
