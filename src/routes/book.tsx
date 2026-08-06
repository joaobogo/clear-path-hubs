/**
 * /book — one screen: who you are, and which time you want.
 *
 * Name, email, phone and a real slot from our own calendar, all visible at
 * once. Nothing is invented: every slot shown is one we actually hold open,
 * and double-booking is prevented server-side.
 *
 * Returning visitors and signed-in clients get their details filled in for
 * them (from their account profile, or from the last booking made on this
 * device) so the whole thing is a phone number and a click.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Clock, Loader2 } from "lucide-react";
import { MEETING_TYPES, resolveMeetingType } from "@/config/booking";
import { TIMEZONE_CHOICES } from "@/config/scheduler";
import {
  quickBookingSchema,
  quickBookingToIntake,
  type QuickBooking,
} from "@/lib/booking/booking-schema";
import { BOOKING_EVENTS, trackBooking } from "@/lib/booking/booking-events";
import {
  bookBookingSlot,
  cancelBookingSlot,
  getBookingConfirmation,
  listBookingSlots,
  submitBookingIntake,
} from "@/lib/booking/booking.functions";
import { detectTimezone, fullLabel, type Slot } from "@/lib/booking/slots";
import { getAttribution, getPageContext } from "@/lib/crm/attribution";
import { supabase } from "@/integrations/supabase/client";
import { SchedulerPanel } from "@/components/booking/scheduler-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/book")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { type?: string; cta?: string; session?: string } => ({
    type: typeof search["type"] === "string" ? (search["type"] as string) : undefined,
    cta: typeof search["cta"] === "string" ? (search["cta"] as string) : undefined,
    session: typeof search["session"] === "string" ? (search["session"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book a hiring call — one screen, real times | TaaSFlow" },
      {
        name: "description",
        content:
          "Name, email, phone and a live slot from our calendar — all on one screen. Your confirmation arrives straight away.",
      },
      { property: "og:title", content: "Book a hiring call — one screen, real times | TaaSFlow" },
      {
        property: "og:description",
        content: "Give us four details and pick a real time in our calendar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookPage,
});

type Meeting = {
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  hostName: string | null;
  joinUrl: string | null;
};

type ContactValues = Record<"firstName" | "lastName" | "email" | "phone" | "website", string>;

const EMPTY: ContactValues = { firstName: "", lastName: "", email: "", phone: "", website: "" };

const CONTACT_KEY = "taasflow.booking.contact";

const FIELDS: { name: keyof ContactValues; label: string; type?: string; autoComplete: string }[] = [
  { name: "firstName", label: "First name", autoComplete: "given-name" },
  { name: "lastName", label: "Last name", autoComplete: "family-name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone number", type: "tel", autoComplete: "tel" },
];

function readStoredContact(): Partial<ContactValues> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONTACT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const pick = (k: string) => (typeof parsed[k] === "string" ? (parsed[k] as string) : "");
    return {
      firstName: pick("firstName"),
      lastName: pick("lastName"),
      email: pick("email"),
      phone: pick("phone"),
    };
  } catch {
    return null;
  }
}

function storeContact(values: QuickBooking) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONTACT_KEY,
      JSON.stringify({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
      }),
    );
  } catch {
    /* storage disabled — autofill is a convenience, never a requirement */
  }
}

function BookPage() {
  const { type, cta, session } = Route.useSearch();
  const meetingType = resolveMeetingType(type);
  const meeting = MEETING_TYPES[meetingType];

  const submit = useServerFn(submitBookingIntake);
  const loadSlots = useServerFn(listBookingSlots);
  const bookSlot = useServerFn(bookBookingSlot);
  const cancelSlot = useServerFn(cancelBookingSlot);
  const readConfirmation = useServerFn(getBookingConfirmation);

  const [step, setStep] = useState<"book" | "done">("book");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionId, setSessionId] = useState<string | null>(session ?? null);
  const [values, setValues] = useState<ContactValues>(EMPTY);
  const [prefilled, setPrefilled] = useState(false);

  const [tz, setTz] = useState<string>("UTC");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Meeting | null>(null);
  const [cancelled, setCancelled] = useState(false);

  // Browser-only state: resolve after mount so SSR and hydration agree.
  useEffect(() => setTz(detectTimezone()), []);

  useEffect(() => {
    trackBooking(BOOKING_EVENTS.pageViewed, { meetingType, ctaLocation: cta ?? null });
  }, [meetingType, cta]);

  // Autofill: the signed-in account first, then this device's last booking.
  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = readStoredContact();
      let next: Partial<ContactValues> = { ...(stored ?? {}) };

      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        const name = (profile?.full_name ?? user.user_metadata?.["full_name"] ?? "") as string;
        const [first, ...rest] = name.trim().split(/\s+/);
        next = {
          firstName: first || next.firstName || "",
          lastName: rest.join(" ") || next.lastName || "",
          email: profile?.email ?? user.email ?? next.email ?? "",
          phone: profile?.phone ?? next.phone ?? "",
        };

        // A client seat means we can hand them straight to their dashboard.
        const { data: membership } = await supabase
          .from("memberships")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        if (active && membership) setHasWorkspace(true);
      }

      if (!active) return;
      const filled = Object.values(next).some((v) => typeof v === "string" && v.length > 0);
      if (filled) {
        setValues((v) => ({ ...v, ...next } as ContactValues));
        setPrefilled(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const zones = useMemo(() => [...new Set<string>([tz, ...TIMEZONE_CHOICES])], [tz]);

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

  // Times load immediately — the visitor sees real availability before typing.
  useEffect(() => {
    if (session) return;
    void refreshSlots(null);
  }, [session, refreshSlots]);

  // Deep link from the confirmation email: manage an existing booking.
  useEffect(() => {
    if (!session) return;
    void (async () => {
      const row = await readConfirmation({ data: { sessionId: session } }).catch(() => null);
      if (!row) return;
      setSessionId(session);
      if (row.status === "cancelled") {
        setCancelled(true);
        setStep("book");
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
        setStep("book");
        void refreshSlots(session);
      }
    })();
  }, [session, readConfirmation, refreshSlots]);

  /** Saves the contact details once and returns the session to attach a slot to. */
  async function ensureSession(contact: QuickBooking): Promise<string | null> {
    if (sessionId) return sessionId;
    const attribution = { ...getAttribution(), ...getPageContext() } as Record<
      string,
      string | null
    >;
    const result = await submit({
      data: {
        intake: quickBookingToIntake(contact),
        meetingType,
        attribution,
        honeypot: values.website,
      },
    });
    if (result.sessionId) {
      setSessionId(result.sessionId);
      trackBooking(BOOKING_EVENTS.intakeCompleted, {
        meetingType,
        bookingSessionId: result.sessionId,
      });
    }
    return result.sessionId;
  }

  async function onPickSlot(slot: Slot) {
    setErrors({});
    setSlotsError(null);

    const parsed = quickBookingSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      document.getElementById("booking-contact")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setPending(true);
    try {
      const id = await ensureSession(parsed.data).catch(() => null);
      if (!id) {
        setErrors({ form: "We couldn't save your details. Please try again." });
        return;
      }
      storeContact(parsed.data);

      const result = await bookSlot({ data: { sessionId: id, start: slot.start, timezone: tz } });
      if (!result.ok) {
        setSlotsError(
          result.reason === "slot_taken"
            ? "That time was just taken. Pick another one."
            : "We couldn't confirm that time. Please pick another one.",
        );
        await refreshSlots(id);
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
      trackBooking(BOOKING_EVENTS.completed, { meetingType, bookingSessionId: id });
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
        setStep("book");
        await refreshSlots(sessionId);
      }
    } finally {
      setPending(false);
    }
  }

  async function onStartReschedule() {
    setCancelled(false);
    setStep("book");
    await refreshSlots(sessionId);
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
          ? "Your call is confirmed. You can reschedule or cancel from this page at any time."
          : "Four details and a time. Every slot below is one we actually hold open, shown in your timezone."}
      </p>

      {step === "book" ? (
        <div className="mt-8 space-y-6">
          <Card id="booking-contact">
            <CardHeader>
              <CardTitle className="text-base">Your details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {prefilled ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Filled in from your details — change anything that's out of date.
                </p>
              ) : null}
              {FIELDS.map((field) => (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type={field.type ?? "text"}
                    autoComplete={field.autoComplete}
                    value={values[field.name]}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                    aria-invalid={Boolean(errors[field.name])}
                  />
                  {errors[field.name] ? (
                    <p className="text-xs text-destructive">{errors[field.name]}</p>
                  ) : null}
                </div>
              ))}
              {/* Honeypot — hidden from humans. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={values.website}
                onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
              />
            </CardContent>
          </Card>

          {errors["form"] ? <p className="text-sm text-destructive">{errors["form"]}</p> : null}

          <section aria-label="Booking calendar" data-testid="booking-calendar">
            {cancelled ? (
              <p className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                That call is cancelled. Pick a new time below whenever you're ready.
              </p>
            ) : null}

            {slotsError ? <p className="mb-4 text-sm text-destructive">{slotsError}</p> : null}

            {slots === null && !slotsError ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading available times…
              </p>
            ) : null}

            {slots !== null && slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every slot in the next three weeks is taken. Email us and we'll open a time for you.
              </p>
            ) : null}

            {slots !== null && slots.length > 0 ? (
              <SchedulerPanel
                slots={slots}
                timezone={tz}
                timezoneChoices={zones}
                onTimezoneChange={setTz}
                onPick={(slot) => void onPickSlot(slot)}
                pending={pending}
                meetingName={meeting.name}
                durationLabel={`${meeting.durationLabel} meeting`}
                hostName="TaaSFlow"
              />
            ) : null}
          </section>
        </div>
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
                <a
                  className="underline"
                  href={booked.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
              {sessionId ? (
                <Button variant="ghost" asChild>
                  <a
                    href={`/api/public/booking/${sessionId}/ics`}
                    download
                    data-testid="add-to-calendar"
                  >
                    <Clock className="mr-1.5 h-4 w-4" aria-hidden /> Add to calendar
                  </a>
                </Button>
              ) : null}
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
