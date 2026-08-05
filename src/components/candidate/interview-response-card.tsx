import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Check, Link2, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InterviewChangeControls } from "@/components/candidate/interview-change-controls";
import { listMyInterviews, respondToInterview } from "@/lib/scheduling.functions";
import { calendarLink, calendlyLink, formatInZone, viewerTimezone } from "@/lib/scheduling";
import {
  buildCandidateSlots,
  formatAndDuration,
  meetingRolesLine,
  slotDeadlineLine,
} from "@/lib/candidate/interview-slots";

type Props = {
  /** Restrict to one application. Omit to show every live interview. */
  applicationId?: string;
  /** Compact rendering for the dashboard. */
  compact?: boolean;
};

const RESPONSE_LINE: Record<string, string> = {
  declined: "You let us know this doesn't work. We'll send other options.",
  reschedule_requested: "You asked for a different time. We'll come back with new options.",
};

const ERROR_COPY: Record<string, string> = {
  availability_expired: "These times are no longer held. We'll send new ones.",
  slot_in_past: "That time has already passed.",
  slot_not_offered: "That time isn't on offer any more.",
  interview_closed: "This interview is closed.",
};

/**
 * The candidate's interview response card.
 *
 * One tap accepts a time. Times are always shown in the candidate's own zone
 * with the offset stated, expired slots stay visible but disabled, and a failed
 * reply keeps the slots on screen with a retry — never a false "expired".
 */
export function InterviewResponseCard({ applicationId, compact = false }: Props) {
  const list = useServerFn(listMyInterviews);
  const respond = useServerFn(respondToInterview);
  const qc = useQueryClient();
  const tz = useMemo(() => viewerTimezone(), []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["me-interviews"],
    queryFn: () => list(),
  });

  const mut = useMutation({
    mutationFn: (vars: {
      interviewId: string;
      response: "accepted" | "declined" | "reschedule_requested";
      preferredTime?: string;
      note?: string;
    }) => respond({ data: vars }),
    onSuccess: (_res, vars) => {
      toast.success(
        vars.response === "accepted" ? "Time confirmed." : "Thanks — we've passed that on.",
      );
      qc.invalidateQueries({ queryKey: ["me-interviews"] });
      if (applicationId) {
        qc.invalidateQueries({ queryKey: ["me-application", applicationId] });
      }
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "";
      toast.error(ERROR_COPY[msg] ?? "We couldn't save your reply. Please try again.");
    },
    onSettled: () => setPendingSlot(null),
  });

  const items = (data?.items ?? []).filter(
    (i) =>
      i.status !== "cancelled" &&
      (applicationId ? i.application_id === applicationId : true) &&
      (compact ? !i.candidate_response || Boolean(i.scheduled_at) : true),
  );

  if (isLoading) {
    return (
      <section className="rounded-2xl border bg-card p-5" aria-busy="true">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Interviews
        </h2>
        <div className="space-y-2">
          {[0, 1, 2].map((n) => (
            <div key={n} className="h-16 w-full animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-medium mb-2 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Interviews
        </h2>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t load your interview times just now. They are still held — nothing has
          expired.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 min-h-11"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? "Trying again…" : "Try again"}
        </Button>
      </section>
    );
  }

  if (items.length === 0) {
    if (compact) return null;
    return (
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-medium mb-2 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Interviews
        </h2>
        <p className="text-sm text-muted-foreground">No interview scheduled yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" /> Interviews
      </h2>
      <ul className="space-y-4">
        {items.map((i) => {
          const slots = buildCandidateSlots({
            proposedTimes: i.proposed_times,
            availabilityExpiresAt: i.availability_expires_at,
            acceptedTime: i.candidate_response === "accepted" ? i.candidate_selected_time : null,
            candidateResponse: i.candidate_response,
            viewerTz: tz,
          });
          const confirmed = i.candidate_response === "accepted" && i.scheduled_at;
          const roles = meetingRolesLine(i.participant_roles);
          const formatLine = formatAndDuration(i.interview_type, i.duration_minutes);
          const deadline =
            !confirmed && !i.candidate_response
              ? slotDeadlineLine(i.availability_expires_at, tz)
              : null;
          const busy = mut.isPending;

          return (
            <li key={i.id} className="rounded-xl border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={confirmed ? "default" : "secondary"}>
                  {confirmed
                    ? i.awaiting_confirmation
                      ? "Time held"
                      : "Confirmed"
                    : "Choose a time"}
                </Badge>
                <span className="text-xs text-muted-foreground">{i.position_title}</span>
              </div>

              <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                {formatLine ? (
                  <div>
                    <dt className="sr-only">Format</dt>
                    <dd>{formatLine}</dd>
                  </div>
                ) : null}
                {roles ? (
                  <div className="flex items-start gap-1.5">
                    <dt className="sr-only">Who you will meet</dt>
                    <dd className="flex items-start gap-1.5">
                      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {roles}
                    </dd>
                  </div>
                ) : null}
                {i.location ? (
                  <div>
                    <dt className="sr-only">Location</dt>
                    <dd className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {i.location}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="sr-only">Time zone</dt>
                  <dd>All times in your time zone ({tz}).</dd>
                </div>
              </dl>

              {confirmed ? (
                <div className="mt-3 rounded-lg border taas-bg-success-soft p-3">
                  <p className="font-medium">{formatInZone(i.scheduled_at, tz)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i.awaiting_confirmation
                      ? "We're confirming this with the hiring team and will send the invite."
                      : "This time is confirmed. The other times have been released."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <a
                      className="text-xs text-primary underline underline-offset-2"
                      href={calendarLink({
                        title: `Interview · ${i.position_title}`,
                        startIso: i.scheduled_at as string,
                        durationMinutes: i.duration_minutes,
                        location: i.meeting_url ?? i.location ?? undefined,
                      })}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Add to calendar
                    </a>
                    {i.meeting_url ? (
                      <a
                        href={i.meeting_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-xs text-primary underline underline-offset-2"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Join link
                      </a>
                    ) : null}
                  </div>
                  <InterviewChangeControls
                    interviewId={i.id}
                    scheduledAt={i.scheduled_at}
                    status={i.status}
                    applicationId={i.application_id}
                  />
                </div>
              ) : null}

              {!confirmed && slots.length === 0 ? (
                <p className="mt-3 text-muted-foreground">
                  We&apos;re arranging a time and will show the options here.
                </p>
              ) : null}

              {!confirmed && slots.length > 0 ? (
                <>
                  {deadline ? <p className="mt-3 text-xs font-medium">{deadline}</p> : null}
                  <ul className="mt-3 space-y-2">
                    {slots.map((s) => (
                      <li key={s.iso}>
                        <button
                          type="button"
                          aria-label={s.accessibleName}
                          disabled={!s.held || busy}
                          onClick={() => {
                            setPendingSlot(s.iso);
                            mut.mutate({
                              interviewId: i.id,
                              response: "accepted",
                              preferredTime: s.iso,
                              note: notes[i.id] || undefined,
                            });
                          }}
                          className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent min-h-14"
                        >
                          <span className="block font-medium">{s.label}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {pendingSlot === s.iso && busy
                              ? "Confirming…"
                              : (s.unavailableReason ?? "Tap to accept this time")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {!confirmed && !i.candidate_response && slots.some((s) => s.held) ? (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs text-muted-foreground" htmlFor={`note-${i.id}`}>
                    Anything we should know? (optional)
                  </label>
                  <textarea
                    id={`note-${i.id}`}
                    value={notes[i.id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [i.id]: e.target.value }))}
                    rows={2}
                    maxLength={1000}
                    className="w-full rounded-md border bg-background p-2 text-sm"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      className="min-h-11 w-full sm:w-auto"
                      disabled={busy}
                      onClick={() =>
                        mut.mutate({
                          interviewId: i.id,
                          response: "reschedule_requested",
                          note: notes[i.id] || undefined,
                        })
                      }
                    >
                      Ask for another time
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-11 w-full sm:w-auto"
                      disabled={busy}
                      onClick={() =>
                        mut.mutate({
                          interviewId: i.id,
                          response: "declined",
                          note: notes[i.id] || undefined,
                        })
                      }
                    >
                      None of these work
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Asking for another time is completely normal — it doesn&apos;t affect your
                    application.
                  </p>
                </div>
              ) : null}

              {!confirmed && i.candidate_response && RESPONSE_LINE[i.candidate_response] ? (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {RESPONSE_LINE[i.candidate_response]}
                </p>
              ) : null}

              {i.scheduling_method === "calendly" &&
              calendlyLink(i.calendly_url ?? "", {
                positionTitle: i.position_title,
                returnTo: applicationId ? `/me/applications/${applicationId}` : "/me",
              }) ? (
                <a
                  href={
                    calendlyLink(i.calendly_url ?? "", {
                      positionTitle: i.position_title,
                      returnTo: applicationId ? `/me/applications/${applicationId}` : "/me",
                    })!
                  }
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-block text-xs text-primary underline underline-offset-2"
                >
                  Pick a time on the scheduling page
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
