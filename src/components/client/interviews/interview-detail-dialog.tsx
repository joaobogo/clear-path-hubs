import { useState } from "react";
import type { InterviewDTO } from "@/lib/interviews.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Users2,
  Video,
  X,
} from "lucide-react";
import { DetailRow } from "./detail-row";
import { ProposeForm } from "./propose-form";
import { ConfirmForm } from "./confirm-form";
import { detectTimezone, formatWhen, statusBadgeClass } from "./helpers";
import {
  displayInterviewStatus,
  hasInterviewHappened,
  interviewStatusLabel,
} from "@/lib/interview-timing";

/**
 * Interview detail dialog — view mode plus the propose / confirm / reschedule /
 * cancel / complete sub-forms, all in one modal that swaps its body by `mode`.
 * Mutations live in the route; this component only reports intent via callbacks.
 */
export function InterviewDetailDialog({
  interview,
  readOnly,
  onClose,
  onPropose,
  onConfirm,
  onCancel,
  onComplete,
  onScorecard,
  pending,
}: {
  interview: InterviewDTO;
  readOnly: boolean;
  onClose: () => void;
  onPropose: (times: string[]) => void;
  onConfirm: (payload: {
    scheduledAt: string;
    timezone: string;
    durationMinutes: number;
    meetingUrl?: string;
    location?: string;
  }) => void;
  onCancel: (reason?: string) => void;
  onComplete: (feedback?: string) => void;
  onScorecard: () => void;
  pending: boolean;
}) {
  const [mode, setMode] = useState<
    "view" | "propose" | "confirm" | "reschedule" | "cancel" | "complete"
  >("view");
  const [times, setTimes] = useState<string[]>(interview.proposed_times.length ? interview.proposed_times : [""]);
  const [scheduledAt, setScheduledAt] = useState<string>(
    interview.scheduled_at ? interview.scheduled_at.slice(0, 16) : "",
  );
  const [tz, setTz] = useState<string>(interview.timezone || detectTimezone());
  const [duration, setDuration] = useState<number>(interview.duration_minutes ?? 45);
  const [meetingUrl, setMeetingUrl] = useState<string>(interview.meeting_url ?? "");
  const [location, setLocation] = useState<string>(interview.location ?? "");
  const [reason, setReason] = useState<string>("");
  const [feedback, setFeedback] = useState<string>(interview.feedback ?? "");
  // Card and modal read the same record through the same derivation, so the
  // words never disagree; a future meeting can never present as completed.
  const shownStatus = displayInterviewStatus(interview);
  const happened = hasInterviewHappened(interview);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {interview.candidate?.name ?? "Interview"}
            <span className="mx-2 text-muted-foreground">·</span>
            {interview.position?.title ?? "Position"}
          </DialogTitle>
          <DialogDescription>
            <span
              className={`mr-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(shownStatus)}`}
            >
              {interviewStatusLabel(interview)}
            </span>
            {interview.interview_type ? (
              <span className="capitalize">{interview.interview_type.replace(/_/g, " ")}</span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {mode === "view" ? (
          <div className="space-y-4 text-sm">
            <DetailRow icon={<Clock className="h-4 w-4" />} label="When">
              {formatWhen(interview.scheduled_at, interview.timezone)}
              {interview.timezone ? (
                <span className="ml-1 text-muted-foreground">({interview.timezone})</span>
              ) : null}
              {interview.duration_minutes ? (
                <span className="ml-1 text-muted-foreground">
                  · {interview.duration_minutes} min
                </span>
              ) : null}
            </DetailRow>
            {interview.meeting_url ? (
              <DetailRow icon={<Video className="h-4 w-4" />} label="Meeting">
                <a
                  href={interview.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline break-all"
                >
                  {interview.meeting_url}
                </a>
              </DetailRow>
            ) : null}
            {interview.location ? (
              <DetailRow icon={<MapPin className="h-4 w-4" />} label="Location">
                {interview.location}
              </DetailRow>
            ) : null}
            <DetailRow icon={<Users2 className="h-4 w-4" />} label="Participants">
              {interview.participants.length === 0 ? (
                <span className="text-muted-foreground">
                  No interviewers added yet — add them when you confirm the time.
                </span>
              ) : (
                <ul className="space-y-1">
                  {interview.participants.map((p, i) => (
                    <li key={i}>
                      <span className="font-medium">{p.name}</span>
                      {p.role ? (
                        <span className="ml-1 text-muted-foreground">· {p.role}</span>
                      ) : null}
                      {p.email ? (
                        <span className="ml-1 text-muted-foreground">· {p.email}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </DetailRow>
            {interview.proposed_times.length > 0 && interview.status !== "scheduled" ? (
              <DetailRow icon={<CalendarClock className="h-4 w-4" />} label="Proposed times">
                <ul className="space-y-0.5">
                  {interview.proposed_times.map((t, i) => (
                    <li key={i}>
                      {formatWhen(t, interview.timezone)}
                      {interview.candidate_selected_time === t ? (
                        <span className="ml-2 text-xs font-medium text-primary">candidate's pick</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {interview.availability_expires_at ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(interview.availability_expires_at).getTime() < Date.now()
                      ? "These times have expired — propose new ones."
                      : `Valid until ${formatWhen(interview.availability_expires_at, interview.timezone)}`}
                  </p>
                ) : null}
              </DetailRow>
            ) : null}
            {interview.candidate_response ? (
              <DetailRow icon={<Users2 className="h-4 w-4" />} label="Candidate reply">
                <p className="capitalize">{interview.candidate_response.replace(/_/g, " ")}</p>
                {interview.candidate_note ? (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{interview.candidate_note}</p>
                ) : null}
                {interview.candidate_response_at ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(interview.candidate_response_at).toLocaleString()}
                  </p>
                ) : null}
              </DetailRow>
            ) : null}
            {interview.reschedule_count > 0 ? (
              <DetailRow icon={<Clock className="h-4 w-4" />} label="Rescheduled">
                {interview.reschedule_count} time{interview.reschedule_count === 1 ? "" : "s"}
              </DetailRow>
            ) : null}

            {interview.notes ? (
              <DetailRow icon={<Circle className="h-4 w-4" />} label="Notes">
                <p className="whitespace-pre-wrap">{interview.notes}</p>
              </DetailRow>
            ) : null}
            {interview.cancel_reason ? (
              <DetailRow icon={<X className="h-4 w-4" />} label="Cancel reason">
                <p className="whitespace-pre-wrap">{interview.cancel_reason}</p>
              </DetailRow>
            ) : null}
            {interview.feedback ? (
              <DetailRow icon={<CheckCircle2 className="h-4 w-4" />} label="Feedback">
                <p className="whitespace-pre-wrap">{interview.feedback}</p>
              </DetailRow>
            ) : null}
            {/* Internal identifiers are deliberately not rendered: clients
              * never need a UUID, and showing one reads as a leak. */}
          </div>
        ) : null}

        {mode === "propose" ? (
          <ProposeForm times={times} setTimes={setTimes} />
        ) : null}

        {mode === "confirm" || mode === "reschedule" ? (
          <ConfirmForm
            scheduledAt={scheduledAt}
            setScheduledAt={setScheduledAt}
            tz={tz}
            setTz={setTz}
            duration={duration}
            setDuration={setDuration}
            meetingUrl={meetingUrl}
            setMeetingUrl={setMeetingUrl}
            location={location}
            setLocation={setLocation}
          />
        ) : null}

        {mode === "cancel" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (optional)</label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
            />
          </div>
        ) : null}

        {mode === "complete" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">Feedback (optional)</label>
            <Textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={4000}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          {mode === "view" && !readOnly ? (
            <>
              {shownStatus === "cancelled" || shownStatus === "completed" ? null : (
                <Button variant="outline" onClick={() => setMode("cancel")}>
                  Cancel
                </Button>
              )}
              {shownStatus === "requested" ? (
                <Button variant="outline" onClick={() => setMode("propose")}>
                  Propose times
                </Button>
              ) : null}
              {shownStatus === "requested" || shownStatus === "scheduling" ? (
                <Button onClick={() => setMode("confirm")}>Confirm time</Button>
              ) : null}
              {shownStatus === "scheduled" ? (
                <>
                  <Button variant="outline" onClick={() => setMode("reschedule")}>
                    Reschedule
                  </Button>
                  {happened ? (
                    <Button onClick={() => setMode("complete")}>Mark completed</Button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}

          {mode !== "view" ? (
            <>
              <Button variant="ghost" onClick={() => setMode("view")} disabled={pending}>
                Back
              </Button>
              {mode === "propose" ? (
                <Button
                  disabled={pending}
                  onClick={() =>
                    onPropose(
                      times
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .map((t) => new Date(t).toISOString()),
                    )
                  }
                >
                  {pending ? "Saving…" : "Send proposals"}
                </Button>
              ) : null}
              {mode === "confirm" || mode === "reschedule" ? (
                <Button
                  disabled={pending || !scheduledAt}
                  onClick={() =>
                    onConfirm({
                      scheduledAt: new Date(scheduledAt).toISOString(),
                      timezone: tz,
                      durationMinutes: duration,
                      meetingUrl: meetingUrl.trim() || undefined,
                      location: location.trim() || undefined,
                    })
                  }
                >
                  {pending ? "Saving…" : mode === "reschedule" ? "Reschedule" : "Confirm"}
                </Button>
              ) : null}
              {mode === "cancel" ? (
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => onCancel(reason.trim() || undefined)}
                >
                  {pending ? "Cancelling…" : "Cancel interview"}
                </Button>
              ) : null}
              {mode === "complete" ? (
                <>
                  <Button variant="outline" disabled={pending} onClick={onScorecard}>
                    Record structured feedback
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => onComplete(feedback.trim() || undefined)}
                  >
                    {pending ? "Saving…" : "Mark completed without scorecard"}
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
