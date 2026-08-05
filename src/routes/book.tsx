/**
 * /book — the single booking destination for the whole site.
 *
 * Step 1: TaaSFlow intake (our design, our validation, stored by us).
 * Step 2: our OWN scheduler — real slots from our business hours, in the
 *         visitor's timezone, with double-booking prevented server-side.
 * Step 3: an honest confirmation with working reschedule and cancel.
 *
 * No external scheduling account is involved anywhere in this flow.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Clock, Loader2 } from "lucide-react";
import {
  COMPANY_SIZES,
  CURRENT_PROCESSES,
  HEARD_ABOUT,
  HIRING_TIMELINES,
  HIRING_VOLUMES,
  MEETING_TYPES,
  OPEN_ROLE_COUNTS,
  resolveMeetingType,
} from "@/config/booking";
import { TIMEZONE_CHOICES } from "@/config/scheduler";
import { bookingIntakeSchema, type BookingIntake } from "@/lib/booking/booking-schema";
import { BOOKING_EVENTS, trackBooking } from "@/lib/booking/booking-events";
import {
  bookBookingSlot,
  cancelBookingSlot,
  getBookingConfirmation,
  listBookingSlots,
  submitBookingIntake,
} from "@/lib/booking/booking.functions";
import {
  detectTimezone,
  fullLabel,
  groupByDay,
  rangeLabel,
  type Slot,
} from "@/lib/booking/slots";
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
    session: typeof search["session"] === "string" ? (search["session"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book a hiring call — pick a real time | TaaSFlow" },
      {
        name: "description",
        content:
          "Answer a few questions about your hiring, then choose a live time in our calendar. You get the confirmation straight away.",
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

type Meeting = {
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  hostName: string | null;
  joinUrl: string | null;
};

function BookPage() {
  const { type, cta, session } = Route.useSearch();
  const meetingType = resolveMeetingType(type);
  const meeting = MEETING_TYPES[meetingType];

  const submit = useServerFn(submitBookingIntake);
  const loadSlots = useServerFn(listBookingSlots);
  const bookSlot = useServerFn(bookBookingSlot);
  const cancelSlot = useServerFn(cancelBookingSlot);
  const readConfirmation = useServerFn(getBookingConfirmation);

  const [step, setStep] = useState<"intake" | "schedule" | "done">("intake");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | null>(session ?? null);
  const [values, setValues] = useState<Record<string, string>>({});

  const [tz, setTz] = useState<string>("UTC");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Meeting | null>(null);
  const [cancelled, setCancelled] = useState(false);

  // Timezone is browser-only state: resolve it after mount so SSR and the first
  // client render agree.
  useEffect(() => setTz(detectTimezone()), []);

  useEffect(() => {
    trackBooking(BOOKING_EVENTS.pageViewed, { meetingType, ctaLocation: cta ?? null });
  }, [meetingType, cta]);

  const zones = useMemo(() => {
    const set = new Set<string>([tz, ...TIMEZONE_CHOICES]);
    return [...set];
  }, [tz]);

  const refreshSlots = useCallback(
    async (id: string | null) => {
      setSlotsError(null);
      try {
        const result = await loadSlots({ data: { sessionId: id } });
        setSlots(result.slots);
      } catch {
        setSlots(null);
        setSlotsError("We couldn't load available times. Please try again.");
      }
    },
    [loadSlots],
  );

  // Deep link from the confirmation email: manage an existing booking.
  useEffect(() => {
    if (!session) return;
    void (async () => {
      const row = await readConfirmation({ data: { sessionId: session } }).catch(() => null);
      if (!row) return;
      setSessionId(session);
      if (row.status === "cancelled") {
        setCancelled(true);
        setStep("schedule");
        void refreshSlots(session);
        return;
      }
      if (row.scheduledStart && row.scheduledEnd) {
        setBooked({
          scheduledStart: row.scheduledStart,
          scheduledEnd: row.scheduledEnd,
          timezone: row.timezone ?? "UTC",
          hostName: row.hostName,
          joinUrl: row.joinUrl,
        });
        setStep("done");
      } else {
        setStep("schedule");
        void refreshSlots(session);
      }
    })();
  }, [session, readConfirmation, refreshSlots]);

  const days = useMemo(() => (slots ? groupByDay(slots, tz) : []), [slots, tz]);

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
      trackBooking(BOOKING_EVENTS.intakeCompleted, {
        meetingType,
        bookingSessionId: result.sessionId,
      });
      await refreshSlots(result.sessionId);
    } catch {
      setErrors({ form: "We couldn't save your details. Please try again." });
    } finally {
      setPending(false);
    }
  }

  async function onPickSlot(slot: Slot) {
    if (!sessionId) return;
    setPending(true);
    setSlotsError(null);
    try {
      const result = await bookSlot({
        data: { sessionId, start: slot.start, timezone: tz },
      });
      if (!result.ok) {
        setSlotsError(
          result.reason === "slot_taken"
            ? "That time was just taken. Pick another one."
            : "We couldn't confirm that time. Please pick another one.",
        );
        await refreshSlots(sessionId);
        return;
      }
      setBooked({
        scheduledStart: result.meeting.scheduledStart,
        scheduledEnd: result.meeting.scheduledEnd,
        timezone: result.meeting.timezone,
        hostName: result.meeting.hostName,
        joinUrl: result.meeting.joinUrl,
      });
      setCancelled(false);
      setStep("done");
      trackBooking(BOOKING_EVENTS.completed, { meetingType, bookingSessionId: sessionId });
    } catch {
      setSlotsError("We couldn't confirm that time. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function onCancel() {
    if (!sessionId) return;
    setPending(true);
    try {
      const result = await cancelSlot({ data: { sessionId } });
      if (result.ok) {
        setBooked(null);
        setCancelled(true);
        setStep("schedule");
        await refreshSlots(sessionId);
      }
    } finally {
      setPending(false);
    }
  }

  async function onStartReschedule() {
    setCancelled(false);
    setStep("schedule");
    await refreshSlots(sessionId);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {meeting.durationLabel} · {meeting.name}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {step === "done" ? "You're booked" : step === "schedule" ? "Pick a time" : "Book your hiring call"}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {step === "done"
          ? "Your call is confirmed. You can reschedule or cancel from this page at any time."
          : step === "schedule"
            ? "Every time below is one we actually hold open. Times are shown in your timezone."
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
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
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
                    aria-invalid={Boolean(errors[field.name])}
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
        <section className="mt-8" aria-label="Booking calendar" data-testid="booking-calendar">
          {cancelled ? (
            <p className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              That call is cancelled. Pick a new time below whenever you're ready.
            </p>
          ) : null}

          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Your timezone</Label>
              <select
                id="timezone"
                className="h-10 w-[260px] rounded-md border border-input bg-background px-3 text-sm"
                value={tz}
                onChange={(e) => setTz(e.target.value)}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={() => void refreshSlots(sessionId)} disabled={pending}>
              Refresh times
            </Button>
          </div>

          {slotsError ? <p className="mb-4 text-sm text-destructive">{slotsError}</p> : null}

          {slots === null && !slotsError ? (
            <p className="text-sm text-muted-foreground">Loading available times…</p>
          ) : null}

          {slots !== null && days.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Every slot in the next two weeks is taken. Your details are saved — we'll email you with
              the next openings.
            </p>
          ) : null}

          <div className="space-y-6">
            {days.map((day) => (
              <div key={day.key}>
                <h2 className="text-sm font-semibold">{day.label}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {day.slots.map((slot) => (
                    <Button
                      key={slot.start}
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      data-slot-start={slot.start}
                      onClick={() => void onPickSlot(slot)}
                    >
                      <Clock className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      {rangeLabel(slot.start, slot.end, tz)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {step === "done" && booked ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4" aria-hidden /> Your call
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-base font-semibold text-foreground" data-testid="booked-when">
              {fullLabel(booked.scheduledStart, booked.scheduledEnd, booked.timezone)}
            </p>
            <p className="text-muted-foreground">
              {booked.hostName ? `With ${booked.hostName}. ` : ""}
              {booked.joinUrl
                ? "The meeting link is below and in your confirmation email."
                : "We'll email you the meeting link before the call."}
            </p>
            {booked.joinUrl ? (
              <p>
                <a className="underline" href={booked.joinUrl} target="_blank" rel="noopener noreferrer">
                  Join the meeting
                </a>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void onStartReschedule()} disabled={pending}>
                Reschedule
              </Button>
              <Button variant="ghost" onClick={() => void onCancel()} disabled={pending}>
                Cancel this call
              </Button>
            </div>

            <div className="border-t pt-4 text-muted-foreground">
              <p className="font-medium text-foreground">On the call</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {meeting.agenda.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 font-medium text-foreground">Worth bringing</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {meeting.prepare.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
