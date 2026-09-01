import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { formatDateTime, pluralize } from "@/lib/format/datetime";
import { liveSlots } from "@/lib/scheduling";
import { interviewBuckets } from "@/lib/client/interview-buckets";
import { interviewHolder, type InterviewHolder } from "@/lib/client/interview-holder";
import type { InterviewDTO } from "@/lib/interviews.functions";

/**
 * Interviews without a confirmed time, grouped by WHO OWES THE NEXT MOVE.
 *
 * This was one block headed "Waiting on you to confirm a time", listing every
 * pending interview regardless of whether any time had ever been proposed. On
 * Northwind it put three interviews under that heading while each row read "No
 * times sent yet" — there was nothing for the client to confirm, TaaSFlow had
 * never sent slots, and the SLA desk recorded the resulting breach at 267.5h
 * against a 24h commitment. A commitment we had missed by eleven days was
 * presented to the client as work waiting on them (audit 1 Sep, F16).
 *
 * Everywhere else this product is careful about this — the Offers page has a
 * "Whose turn it is" column and "Answers we owe candidates" is built entirely
 * around owning failures. This screen inverted it.
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
  const pending = interviewBuckets(interviews).awaiting;
  if (pending.length === 0) return null;

  const withHolder = pending.map((iv) => ({ iv, ...interviewHolder(iv) }));
  const oursToSend = withHolder.filter((r) => r.holder === "us");
  const theirsToConfirm = withHolder.filter((r) => r.holder === "client");

  return (
    <div className="space-y-6">
      {oursToSend.length > 0 && (
        <Group
          id="awaiting-taasflow"
          heading="Waiting on TaaSFlow"
          count={oursToSend.length}
          rows={oursToSend}
          readOnly={readOnly}
          busyId={busyId}
          onSendNewTimes={onSendNewTimes}
        />
      )}
      {theirsToConfirm.length > 0 && (
        <Group
          id="awaiting-confirmation"
          heading="Waiting on you to confirm a time"
          count={theirsToConfirm.length}
          rows={theirsToConfirm}
          readOnly={readOnly}
          busyId={busyId}
          onConfirm={onConfirm}
        />
      )}
    </div>
  );
}

function Group({
  id,
  heading,
  count,
  rows,
  readOnly,
  busyId,
  onConfirm,
  onSendNewTimes,
}: {
  id: string;
  heading: string;
  count: number;
  rows: Array<{ iv: InterviewDTO; holder: InterviewHolder; status: string }>;
  readOnly: boolean;
  busyId?: string | null;
  onConfirm?: (interview: InterviewDTO) => void;
  onSendNewTimes?: (interview: InterviewDTO) => void;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-lg font-semibold">
          {heading}
        </h2>
        <span className="text-sm text-muted-foreground">{pluralize(count, "interview")}</span>
      </div>
      <div className="space-y-2">
        {rows.map(({ iv, holder, status }) => {
          const slots = liveSlots(iv.proposed_times ?? [], iv.availability_expires_at)
            .slice()
            .sort();
          const earliest = slots[0] ?? null;
          return (
            <Card
              key={iv.id}
              id={`awaiting-${iv.id}`}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{iv.candidate?.name ?? "Candidate"}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {iv.position?.title ?? "Your role"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  {/* One string, derived from the record. The two the page used
                      to show were mutually exclusive: "No times still available
                      — we will send new ones" says slots were sent and lapsed,
                      "No times sent yet" says none ever were. */}
                  {slots.length > 0 && earliest
                    ? `${pluralize(slots.length, "proposed time")} · earliest ${formatDateTime(earliest)}`
                    : status}
                </p>
              </div>
              {!readOnly ? (
                holder === "client" && onConfirm ? (
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
                    {busyId === iv.id
                      ? "Sending…"
                      : (iv.proposed_times ?? []).length > 0
                        ? "Send new times"
                        : "Send times"}
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
