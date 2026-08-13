import { useMemo } from "react";
import type { InterviewDTO } from "@/lib/interviews.functions";
import {
  dualZone,
  liveSlots,
  relativeDay,
  viewerTimezone,
  calendarLink,
} from "@/lib/scheduling";
import { buildIcs, downloadIcs } from "@/lib/availability";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlotProposer, type ProposalSubmission } from "./slot-proposer";
import { AgeBadge } from "@/components/client/age-badge";
import {
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  RefreshCw,
  Sparkles,
  Video,
  XCircle,
} from "lucide-react";

type Marker = {
  dot: string;
  label: string;
  icon: typeof Clock;
};

function marker(iv: InterviewDTO): Marker {
  switch (iv.status) {
    case "requested":
      return { dot: "taas-bg-warning-solid", label: "Needs times", icon: Circle };
    case "scheduling":
      return { dot: "taas-bg-info-solid", label: "Proposed — awaiting candidate", icon: Clock };
    case "scheduled":
      return { dot: "taas-bg-success-solid", label: "Confirmed", icon: CheckCircle2 };
    case "completed":
      return { dot: "taas-bg-neutral-solid", label: "Completed", icon: CheckCircle2 };
    default:
      return { dot: "taas-bg-danger-solid", label: "Cancelled", icon: XCircle };
  }
}

function anchor(iv: InterviewDTO): number {
  const iso =
    iv.scheduled_at ??
    iv.completed_at ??
    (iv.proposed_times.length > 0 ? iv.proposed_times[0] : null) ??
    iv.requested_at;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isPastItem(iv: InterviewDTO): boolean {
  if (iv.status === "completed" || iv.status === "cancelled") return true;
  return !!iv.scheduled_at && new Date(iv.scheduled_at).getTime() < Date.now();
}

/**
 * One timeline: proposed, confirmed and completed interviews on a single axis,
 * every time rendered in the interview timezone and the viewer's own.
 */
export function InterviewTimeline({
  interviews,
  readOnly,
  hasWindows,
  onOpen,
  onProposeFromAvailability,
  onReschedule,
  busyId,
  timezone,
  proposingId,
  onStartPropose,
  onCancelPropose,
  onSubmitPropose,
  proposeSubmitting = false,
  proposeFailed = null,
}: {
  interviews: InterviewDTO[];
  readOnly: boolean;
  hasWindows: boolean;
  onOpen: (iv: InterviewDTO) => void;
  onProposeFromAvailability: (iv: InterviewDTO) => void;
  onReschedule: (iv: InterviewDTO) => void;
  busyId?: string | null;
  timezone: string;
  proposingId?: string | null;
  onStartPropose?: (iv: InterviewDTO) => void;
  onCancelPropose?: () => void;
  onSubmitPropose?: (iv: InterviewDTO, proposal: ProposalSubmission) => void;
  proposeSubmitting?: boolean;
  proposeFailed?: string | null;
}) {
  const tz = viewerTimezone();
  const { upcoming, past } = useMemo(() => {
    const sorted = [...interviews].sort((a, b) => anchor(a) - anchor(b));
    return {
      upcoming: sorted.filter((i) => !isPastItem(i)),
      past: sorted.filter(isPastItem).reverse(),
    };
  }, [interviews]);

  const render = (iv: InterviewDTO) => (
    <TimelineItem
      key={iv.id}
      interview={iv}
      viewerTz={tz}
      readOnly={readOnly}
      hasWindows={hasWindows}
      busy={busyId === iv.id}
      onOpen={() => onOpen(iv)}
      onProposeFromAvailability={() => onProposeFromAvailability(iv)}
      onReschedule={() => onReschedule(iv)}
      timezone={timezone}
      proposing={proposingId === iv.id}
      proposeSubmitting={proposeSubmitting}
      proposeFailed={proposeFailed}
      onStartPropose={onStartPropose ? () => onStartPropose(iv) : undefined}
      onCancelPropose={onCancelPropose}
      onSubmitPropose={onSubmitPropose ? (p) => onSubmitPropose(iv, p) : undefined}
    />
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-medium text-muted-foreground">Coming up</h2>
        <div className="mt-2 space-y-0">
          {upcoming.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing scheduled yet.
            </p>
          ) : (
            upcoming.map(render)
          )}
        </div>
      </section>
      {past.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground">Already happened</h2>
          <div className="mt-2 space-y-0">{past.map(render)}</div>
        </section>
      ) : null}
    </div>
  );
}

function TimelineItem({
  interview: iv,
  viewerTz,
  readOnly,
  hasWindows,
  busy,
  onOpen,
  onProposeFromAvailability,
  onReschedule,
  timezone,
  proposing,
  proposeSubmitting,
  proposeFailed,
  onStartPropose,
  onCancelPropose,
  onSubmitPropose,
}: {
  interview: InterviewDTO;
  viewerTz: string;
  readOnly: boolean;
  hasWindows: boolean;
  busy: boolean;
  onOpen: () => void;
  onProposeFromAvailability: () => void;
  onReschedule: () => void;
  timezone: string;
  proposing: boolean;
  proposeSubmitting: boolean;
  proposeFailed: string | null;
  onStartPropose?: () => void;
  onCancelPropose?: () => void;
  onSubmitPropose?: (proposal: ProposalSubmission) => void;
}) {
  const m = marker(iv);
  const Icon = m.icon;
  const slots = liveSlots(iv.proposed_times, iv.availability_expires_at);
  const when = dualZone(iv.scheduled_at, iv.timezone, viewerTz);
  const title = `Interview — ${iv.position?.title ?? "Role"}`;
  // Action labels name the candidate and role so they stay unambiguous for
  // screen readers and stable as Playwright selectors.
  const subject = `${iv.candidate?.name ?? "candidate"} for ${iv.position?.title ?? "this role"}`;

  return (
    <div className="relative grid grid-cols-[auto_1fr] gap-3 pb-4">
      <div className="flex flex-col items-center">
        <span className={`mt-2 h-2.5 w-2.5 rounded-full ${m.dot}`} />
        <span className="mt-1 w-px flex-1 bg-border" />
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
            <Icon className="h-3.5 w-3.5" /> {m.label}
          </span>
          {iv.interview_type ? (
            <Badge variant="outline" className="capitalize font-normal">
              {iv.interview_type.replace(/_/g, " ")}
            </Badge>
          ) : null}
          {iv.reschedule_count > 0 ? (
            <Badge variant="outline" className="font-normal">
              Rescheduled ×{iv.reschedule_count}
            </Badge>
          ) : null}
          {iv.status === "requested" || iv.status === "scheduling" ? (
            <AgeBadge since={iv.created_at} />
          ) : null}
        </div>

        <button
          onClick={onOpen}
          className="mt-1.5 block text-left"
          aria-label={`Open interview details for ${subject}`}
        >
          <span className="font-medium">{iv.candidate?.name ?? "Candidate"}</span>
          <span className="mx-1.5 text-muted-foreground">·</span>
          <span className="text-muted-foreground">{iv.position?.title ?? "Role"}</span>
        </button>

        <div className="mt-2 space-y-1 text-sm">
          {iv.scheduled_at ? (
            <>
              <div className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{when.primary}</span>
                <span className="text-muted-foreground">({relativeDay(iv.scheduled_at)})</span>
              </div>
              {when.viewer ? (
                <div className="text-xs text-muted-foreground">Your time: {when.viewer}</div>
              ) : null}
            </>
          ) : slots.length > 0 ? (
            <div className="text-muted-foreground">
              {slots.length} time{slots.length === 1 ? "" : "s"} with the candidate — first option{" "}
              {relativeDay(slots[0])}
            </div>
          ) : (
            <div className="text-muted-foreground">No times sent yet</div>
          )}
          {iv.meeting_url ? (
            <a
              href={iv.meeting_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <Video className="h-3.5 w-3.5" /> Join link
            </a>
          ) : null}
        </div>

        {proposing && onSubmitPropose ? (
          <div className="mt-3 rounded-lg border bg-background p-3">
            <SlotProposer
              timezone={iv.timezone || timezone}
              submitting={proposeSubmitting}
              failed={proposeFailed}
              submitLabel="Send proposed times"
              onCancel={() => onCancelPropose?.()}
              onSubmit={(p) => onSubmitPropose(p)}
              initial={{
                ...(iv.interview_type === "video_call" ||
                iv.interview_type === "phone_screen" ||
                iv.interview_type === "onsite"
                  ? { format: iv.interview_type }
                  : {}),
                ...(iv.duration_minutes ? { durationMinutes: iv.duration_minutes } : {}),
              }}
            />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {!readOnly && !proposing && iv.status === "requested" && onStartPropose ? (
            <Button
              size="sm"
              className="min-h-11 sm:min-h-9"
              disabled={busy}
              onClick={onStartPropose}
              aria-label={`Propose interview times for ${subject}`}
            >
              <Clock className="mr-1.5 h-4 w-4" /> Propose times
            </Button>
          ) : null}
          {!readOnly && !proposing && iv.status === "requested" ? (
            <Button
              size="sm"
              className="min-h-11 sm:min-h-9"
              disabled={busy || !hasWindows}
              onClick={onProposeFromAvailability}
              aria-label={`Send my available times for ${subject}`}
              title={hasWindows ? undefined : "Set your availability first"}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {busy ? "Sending…" : "Send my available times"}
            </Button>
          ) : null}
          {!readOnly && (iv.status === "scheduled" || iv.status === "scheduling") ? (
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 sm:min-h-9"
              disabled={busy}
              onClick={onReschedule}
              aria-label={`Reschedule interview for ${subject}`}
            >
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {busy ? "Working…" : "Reschedule"}
            </Button>
          ) : null}
          {iv.scheduled_at ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  downloadIcs(
                    `interview-${iv.position?.reference ?? iv.id.slice(0, 6)}`,
                    buildIcs({
                      uid: iv.id,
                      title,
                      startIso: iv.scheduled_at!,
                      durationMinutes: iv.duration_minutes ?? 60,
                      location: iv.meeting_url ?? iv.location,
                    }),
                  )
                }
              >
                <Download className="mr-1.5 h-4 w-4" /> Calendar invite
              </Button>
              <a
                href={calendarLink({
                  title,
                  startIso: iv.scheduled_at,
                  durationMinutes: iv.duration_minutes ?? 60,
                  location: iv.meeting_url ?? iv.location,
                })}
                target="_blank"
                rel="noreferrer"
              >
                <Button size="sm" variant="ghost">
                  <CalendarPlus className="mr-1.5 h-4 w-4" /> Google
                </Button>
              </a>
            </>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onOpen}>
            Details
          </Button>
        </div>
      </div>
    </div>
  );
}
