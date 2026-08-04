/**
 * /book — the single booking destination for the whole site.
 *
 * Step 1: TaaSFlow intake (our design, our validation, stored by us).
 * Step 2: the real calendar, embedded inline so the visitor never leaves.
 * Step 3: an honest confirmation built from what we actually recorded.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, ExternalLink, Loader2 } from "lucide-react";
import {
  COMPANY_SIZES,
  CURRENT_PROCESSES,
  HEARD_ABOUT,
  HIRING_TIMELINES,
  HIRING_VOLUMES,
  MEETING_TYPES,
  OPEN_ROLE_COUNTS,
  isSchedulerConfigured,
  resolveMeetingType,
} from "@/config/booking";
import { bookingIntakeSchema, type BookingIntake } from "@/lib/booking/booking-schema";
import { trackBookingEvent } from "@/lib/booking/booking-events";
import { mountCalendlyInline, onCalendlyEvent } from "@/lib/calendly";
import { confirmBookingScheduled, submitBookingIntake } from "@/lib/booking/booking.functions";
import { getAttribution, getPageContext } from "@/lib/crm/attribution";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: typeof search["type"] === "string" ? (search["type"] as string) : undefined,
    cta: typeof search["cta"] === "string" ? (search["cta"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book a hiring call — pick a real time | TaaSFlow" },
      {
        name: "description",
        content:
          "Answer a few questions about your hiring, then choose a live time in our calendar. You get the invite and confirmation straight away.",
      },
      { property: "og:title", content: "Book a hiring call — pick a real time | TaaSFlow" },
      {
        property: "og:description",
        content: "Tell us what you're hiring for and pick a slot in our real calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookPage,
});

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

type Field = { name: keyof BookingIntake; label: string; type?: string; required?: boolean };

const YOU: Field[] = [
  { name: "firstName", label: "First name", required: true },
  { name: "lastName", label: "Last name", required: true },
  { name: "email", label: "Work email", type: "email", required: true },
  { name: "phone", label: "Phone (optional)", type: "tel" },
  { name: "jobTitle", label: "Job title", required: true },
  { name: "companyName", label: "Company", required: true },
  { name: "companyWebsite", label: "Company website (optional)" },
];

const SELECTS: { name: keyof BookingIntake; label: string; options: readonly string[] }[] = [
  { name: "companySize", label: "Company size", options: COMPANY_SIZES },
  { name: "openRoles", label: "Open roles right now", options: OPEN_ROLE_COUNTS },
  { name: "hiringVolume", label: "Hires expected this year", options: HIRING_VOLUMES },
  { name: "hiringTimeline", label: "When you need someone", options: HIRING_TIMELINES },
  { name: "currentProcess", label: "How you hire today", options: CURRENT_PROCESSES },
  { name: "heardAbout", label: "How you found us", options: HEARD_ABOUT },
];

function BookPage() {
  const { type, cta } = Route.useSearch();
  const meetingType = resolveMeetingType(type);
  const meeting = MEETING_TYPES[meetingType];
  const tz = useMemo(() => timeZone(), []);

  const submit = useServerFn(submitBookingIntake);
  const confirm = useServerFn(confirmBookingScheduled);

  const [step, setStep] = useState<"intake" | "schedule" | "done">("intake");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const embedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    trackBookingEvent("booking_started", { meetingType, ctaLocation: cta ?? null });
  }, [meetingType, cta]);

  // Only the scheduler's own confirmation counts as a booking.
  useEffect(
    () =>
      onCalendlyEvent((name, payload) => {
        if (name !== "calendly.event_scheduled") return;
        setStep("done");
        trackBookingEvent("booking_completed", { meetingType, bookingSessionId: sessionId });
        if (sessionId) {
          void confirm({
            data: {
              sessionId,
              calendlyEventUri: payload.eventUri,
              calendlyInviteeUri: payload.inviteeUri,
              timezone: tz,
            },
          }).catch(() => undefined);
        }
      }),
    [confirm, meetingType, sessionId, tz],
  );

  async function mountScheduler(id: string | null) {
    const host = embedRef.current;
    if (!host || !isSchedulerConfigured(meetingType)) {
      setEmbedFailed(true);
      return;
    }
    const result = await mountCalendlyInline({
      parentElement: host,
      url: meeting.schedulingUrl,
      prefill: {
        firstName: values["firstName"] ?? undefined,
        lastName: values["lastName"] ?? undefined,
        email: values["email"] ?? undefined,
      },
      // Carries our session id back through the signed webhook.
      utm: { utmSource: "taasflow", utmMedium: "website", utmContent: id ?? undefined },
    });
    if (!result.ok) {
      setEmbedFailed(true);
      trackBookingEvent("booking_scheduler_failed", { meetingType, reason: result.reason });
    }
  }

  async function onIntakeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    const parsed = bookingIntakeSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setPending(false);
      return;
    }

    try {
      const attribution = { ...getAttribution(), ...getPageContext() } as Record<
        string,
        string | null
      >;
      const result = await submit({
        data: {
          intake: parsed.data,
          meetingType,
          attribution,
          honeypot: values["website"] ?? "",
        },
      });
      setSessionId(result.sessionId);
      setStep("schedule");
      trackBookingEvent("booking_intake_submitted", {
        meetingType,
        bookingSessionId: result.sessionId,
      });
      // The embed needs the container mounted first.
      window.setTimeout(() => void mountScheduler(result.sessionId), 0);
    } catch {
      setErrors({ form: "We couldn't save your details. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {meeting.durationLabel} · {meeting.name}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {step === "done" ? "You're booked" : "Book your hiring call"}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {step === "done"
          ? "The invite is on its way to your inbox, with the reschedule and cancel links inside it."
          : meeting.summary}
      </p>

      {step === "intake" ? (
        <form onSubmit={onIntakeSubmit} className="mt-8 space-y-6" noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About you and your company</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {YOU.map((field) => (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type={field.type ?? "text"}
                    required={field.required}
                    value={values[field.name] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                    aria-invalid={Boolean(errors[field.name])}
                  />
                  {errors[field.name] ? (
                    <p className="text-xs text-destructive">{errors[field.name]}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your hiring</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {SELECTS.map((field) => (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <select
                    id={field.name}
                    name={field.name}
                    required
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={values[field.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {errors[field.name] ? (
                    <p className="text-xs text-destructive">{errors[field.name]}</p>
                  ) : null}
                </div>
              ))}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rolesHiring">Which roles or departments</Label>
                <Input
                  id="rolesHiring"
                  value={values["rolesHiring"] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, rolesHiring: e.target.value }))}
                  aria-invalid={Boolean(errors["rolesHiring"])}
                />
                {errors["rolesHiring"] ? (
                  <p className="text-xs text-destructive">{errors["rolesHiring"]}</p>
                ) : null}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="hiringChallenge">The biggest problem to solve</Label>
                <Textarea
                  id="hiringChallenge"
                  rows={3}
                  value={values["hiringChallenge"] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, hiringChallenge: e.target.value }))}
                  aria-invalid={Boolean(errors["hiringChallenge"])}
                />
                {errors["hiringChallenge"] ? (
                  <p className="text-xs text-destructive">{errors["hiringChallenge"]}</p>
                ) : null}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="additionalContext">Anything else (optional)</Label>
                <Textarea
                  id="additionalContext"
                  rows={2}
                  value={values["additionalContext"] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, additionalContext: e.target.value }))}
                />
              </div>
              {/* Honeypot — hidden from humans. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={values["website"] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
              />
            </CardContent>
          </Card>

          {errors["form"] ? <p className="text-sm text-destructive">{errors["form"]}</p> : null}

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Saving…
              </>
            ) : (
              "Continue to choose a time"
            )}
          </Button>
        </form>
      ) : null}

      {step === "schedule" ? (
        <div className="mt-8">
          <div
            ref={embedRef}
            aria-label="Booking calendar"
            className="min-h-[700px] w-full overflow-hidden rounded-xl border"
          />
          {embedFailed ? (
            <div className="mt-4 rounded-xl border border-warning bg-warning/10 p-4 text-sm">
              <p className="font-medium text-warning-foreground">
                The calendar couldn't load in this browser.
              </p>
              <p className="mt-1 text-muted-foreground">
                Your details are saved — we'll follow up either way. You can also pick a time on our
                scheduling page directly.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void mountScheduler(sessionId)}>
                  Try again
                </Button>
                {isSchedulerConfigured(meetingType) ? (
                  <Button asChild>
                    <a href={meeting.schedulingUrl} target="_blank" rel="noopener noreferrer">
                      Open the scheduling page
                      <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Times are shown in your local time zone ({tz}), and every slot is one we actually hold.
            </p>
          )}
        </div>
      ) : null}

      {step === "done" ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4" aria-hidden /> What happens next
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              You'll get a calendar invite by email. Reschedule and cancel links are in that invite,
              so you stay in control of the time.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {meeting.agenda.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="font-medium text-foreground">Worth bringing</p>
            <ul className="list-disc space-y-1 pl-5">
              {meeting.prepare.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
