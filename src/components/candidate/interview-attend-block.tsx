import { useMemo, useState } from "react";
import { CalendarPlus, Check, Copy, ExternalLink, MapPin, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ATTEND_COPY,
  buildAttendDetails,
  buildIcs,
  icsFilename,
  personLine,
  type AttendPerson,
} from "@/lib/candidate/interview-attend";

type Props = {
  interviewId: string;
  positionTitle: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  interviewType: string | null;
  meetingUrl: string | null;
  location: string | null;
  people: AttendPerson[];
  viewerTz: string;
  /** True while a coordinator is still confirming the held time. */
  awaitingConfirmation?: boolean;
};

/**
 * Everything needed to actually attend: when in the candidate's own zone,
 * format and duration, a one-tap join button or an address with a map link,
 * who they will meet, what to prepare, and a calendar file.
 *
 * Nothing here is invented: each row renders only when the interview record
 * carries that detail, so there is never a dial-in line for a video call that
 * has none, and never "details to follow" when the details already exist.
 */
export function InterviewAttendBlock({
  interviewId,
  positionTitle,
  scheduledAt,
  durationMinutes,
  interviewType,
  meetingUrl,
  location,
  people,
  viewerTz,
  awaitingConfirmation = false,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const details = useMemo(
    () =>
      buildAttendDetails({
        interviewType,
        scheduledAt,
        durationMinutes,
        meetingUrl,
        location,
        people,
        viewerTz,
      }),
    [interviewType, scheduledAt, durationMinutes, meetingUrl, location, people, viewerTz],
  );

  const hasAnyDetail = Boolean(
    details.joinUrl || details.address || details.formatLine || details.people.length,
  );

  if (!scheduledAt) {
    return <p className="text-xs text-muted-foreground">{ATTEND_COPY.empty}</p>;
  }

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copied.`);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy — you can select and copy it instead.");
    }
  };

  const title = `Interview · ${positionTitle}`;

  const downloadIcs = () => {
    const ics = buildIcs({
      uid: interviewId,
      title,
      startIso: scheduledAt,
      durationMinutes,
      location: details.address ?? details.joinUrl,
      url: details.joinUrl,
      description: details.formatLine || null,
    });
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFilename(title);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {ATTEND_COPY.heading}
      </h3>

      <dl className="space-y-1 text-xs">
        <div>
          <dt className="sr-only">When</dt>
          <dd className="text-sm font-medium text-foreground">{details.whenLine}</dd>
        </div>
        {details.formatLine ? (
          <div>
            <dt className="sr-only">Format</dt>
            <dd className="text-muted-foreground">{details.formatLine}</dd>
          </div>
        ) : null}
        {details.people.length > 0 ? (
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <dt className="sr-only">Who you will meet</dt>
            <dd className="flex items-start gap-1.5">
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>You&apos;ll meet {details.people.map(personLine).join(", ")}.</span>
            </dd>
          </div>
        ) : null}
      </dl>

      {details.joinUrl ? (
        <div className="space-y-2">
          <Button asChild className="min-h-12 w-full">
            <a href={details.joinUrl} target="_blank" rel="noreferrer noopener">
              <Video className="h-4 w-4" /> Join the interview
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 w-full justify-start text-xs"
            onClick={() => copy("Join link", details.joinUrl as string)}
          >
            {copied === "Join link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === "Join link" ? "Join link copied" : "Copy join link"}
          </Button>
        </div>
      ) : null}

      {details.address ? (
        <div className="space-y-2 rounded-lg border bg-background/60 p-3">
          <p className="flex items-start gap-1.5 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{details.address}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {details.mapUrl ? (
              <Button asChild variant="outline" size="sm" className="min-h-11 w-full sm:w-auto">
                <a href={details.mapUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="h-3.5 w-3.5" /> Open in maps
                </a>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 w-full text-xs sm:w-auto"
              onClick={() => copy("Address", details.address as string)}
            >
              {copied === "Address" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "Address" ? "Address copied" : "Copy address"}
            </Button>
          </div>
        </div>
      ) : null}

      <Button variant="outline" className="min-h-11 w-full" onClick={downloadIcs}>
        <CalendarPlus className="h-4 w-4" /> Add to calendar
      </Button>

      {details.prepare.length > 0 ? (
        <div>
          <h4 className="text-xs font-medium">{ATTEND_COPY.prepareHeading}</h4>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {details.prepare.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span aria-hidden="true">·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!hasAnyDetail && awaitingConfirmation ? (
        <p className="text-xs text-muted-foreground">
          We&apos;re confirming the joining details and will add them here.
        </p>
      ) : null}
    </div>
  );
}
