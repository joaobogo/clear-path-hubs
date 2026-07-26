import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Link2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listMyInterviews, respondToInterview } from "@/lib/scheduling.functions";
import {
  CANDIDATE_INTERVIEW_LABEL,
  calendarLink,
  calendlyLink,
  dualZone,
  isExpired,
  liveSlots,
  viewerTimezone,
  type InterviewStatusValue,
} from "@/lib/scheduling";

type Props = { applicationId: string };

const RESPONSE_LABEL: Record<string, string> = {
  accepted: "You confirmed you can attend",
  declined: "You let us know this doesn't work",
  reschedule_requested: "You asked for a different time",
};

/**
 * Candidate-facing scheduling card. Shows only real, configured times in the
 * candidate's own timezone alongside the organiser's, and never invents slots.
 */
export function CandidateInterviews({ applicationId }: Props) {
  const list = useServerFn(listMyInterviews);
  const respond = useServerFn(respondToInterview);
  const qc = useQueryClient();
  const tz = useMemo(() => viewerTimezone(), []);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
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
    onSuccess: () => {
      toast.success("Thanks — we've passed that on.");
      qc.invalidateQueries({ queryKey: ["me-interviews"] });
      qc.invalidateQueries({ queryKey: ["me-application", applicationId] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(
        msg === "availability_expired"
          ? "These times have expired. We'll send new ones."
          : msg === "slot_in_past"
            ? "That time has already passed."
            : "We couldn't save your reply. Please try again.",
      );
    },
  });

  const items = (data?.items ?? []).filter(
    (i) => i.application_id === applicationId && i.status !== "cancelled",
  );

  if (isLoading || items.length === 0) return null;

  return (
    <section className="rounded-lg border bg-card p-5 mb-6">
      <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" /> Interviews
      </h2>
      <ul className="space-y-4">
        {items.map((i) => {
          const slots = liveSlots(i.proposed_times, i.availability_expires_at);
          const expired = isExpired(i.availability_expires_at);
          const awaitingReply =
            !i.scheduled_at && !i.candidate_response && slots.length > 0 && !expired;

          return (
            <li key={i.id} className="rounded-md border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="secondary">
                  {CANDIDATE_INTERVIEW_LABEL[i.status as InterviewStatusValue] ?? "Interview"}
                </Badge>
                <span className="text-xs text-muted-foreground">{i.position_title}</span>
              </div>

              {i.scheduled_at ? (
                <>
                  <p className="font-medium">{dualZone(i.scheduled_at, tz, i.timezone).primary}</p>
                  <p className="text-xs text-muted-foreground">
                    {dualZone(i.scheduled_at, tz, i.timezone).secondary}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {i.interview_type ?? "Interview"} · {i.duration_minutes} minutes
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <a
                      className="text-xs text-primary underline underline-offset-2"
                      href={calendarLink({
                        title: `Interview · ${i.position_title}`,
                        startIso: i.scheduled_at,
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
                </>
              ) : expired ? (
                <p className="text-sm text-muted-foreground">
                  The times we offered have passed. We'll be in touch with new options.
                </p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  We're arranging a time and will confirm it here.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    Times shown in your timezone ({tz}).
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {slots.map((s) => {
                      const z = dualZone(s, tz, i.timezone);
                      const active = selected[i.id] === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelected((p) => ({ ...p, [i.id]: s }))}
                          disabled={!awaitingReply}
                          className={`rounded-md border p-3 text-left transition-colors ${
                            active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          } disabled:opacity-60`}
                        >
                          <span className="block text-sm font-medium">{z.primary}</span>
                          <span className="block text-xs text-muted-foreground">
                            {z.secondary}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {i.location ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {i.location}
                </p>
              ) : null}

              {i.scheduling_method === "calendly" && i.calendly_url ? (
                <a
                  href={calendlyLink(i.calendly_url, {
                    role: i.position_title,
                    interviewId: i.id,
                  })}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-block text-xs text-primary underline underline-offset-2"
                >
                  Pick a time on the scheduling page
                </a>
              ) : null}

              {i.candidate_response ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {RESPONSE_LABEL[i.candidate_response] ?? "Reply received"}
                </p>
              ) : awaitingReply ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={notes[i.id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [i.id]: e.target.value }))}
                    placeholder="Anything we should know? (optional)"
                    rows={2}
                    maxLength={1000}
                    className="w-full rounded-md border bg-background p-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={!selected[i.id] || mut.isPending}
                      onClick={() =>
                        mut.mutate({
                          interviewId: i.id,
                          response: "accepted",
                          preferredTime: selected[i.id],
                          note: notes[i.id] || undefined,
                        })
                      }
                    >
                      This time works
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mut.isPending}
                      onClick={() =>
                        mut.mutate({
                          interviewId: i.id,
                          response: "reschedule_requested",
                          note: notes[i.id] || undefined,
                        })
                      }
                    >
                      Suggest another time
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={mut.isPending}
                      onClick={() =>
                        mut.mutate({
                          interviewId: i.id,
                          response: "declined",
                          note: notes[i.id] || undefined,
                        })
                      }
                    >
                      I can't attend
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
