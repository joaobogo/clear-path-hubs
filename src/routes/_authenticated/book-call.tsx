import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { CalendarClock, Check, ExternalLink, Loader2, PhoneCall } from "lucide-react";
import {
  cancelDiscoveryCall,
  confirmDiscoveryCall,
  getBookingState,
  requestDiscoveryCall,
} from "@/lib/booking.functions";
import { DEFAULT_MEETING_TYPE, MEETING_TYPES } from "@/config/booking";
import { PAYMENTS_ENABLED } from "@/config/commerce";
import { mountCalendlyInline, onCalendlyEvent } from "@/lib/calendly";
import { submitToCrm } from "@/lib/crm/submit-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const Route = createFileRoute("/_authenticated/book-call")({
  validateSearch: (search: Record<string, unknown>) => ({
    position: typeof search.position === "string" ? search.position : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book a call — pick a time that suits you | TaaSFlow" },
      {
        name: "description",
        content:
          "Pick a time to talk through your role with our team. Your workspace opens straight away and we agree the plan together on the call.",
      },
      { property: "og:title", content: "Book a call — pick a time that suits you | TaaSFlow" },
      {
        property: "og:description",
        content: "Choose a real time in our diary and start using your workspace immediately.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookCallPage,
});

const CALENDLY_BOOKING_URL = MEETING_TYPES[DEFAULT_MEETING_TYPE].schedulingUrl;

function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatFull(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

function BookCallPage() {
  const { position } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timeZone = useMemo(() => localTimeZone(), []);
  const [notes, setNotes] = useState("");
  const [embedState, setEmbedState] = useState<"idle" | "ready" | "unavailable">("idle");
  const embedRef = useRef<HTMLDivElement | null>(null);
  const callIdRef = useRef<string | null>(null);

  const loadState = useServerFn(getBookingState);
  const request = useServerFn(requestDiscoveryCall);
  const confirm = useServerFn(confirmDiscoveryCall);
  const cancel = useServerFn(cancelDiscoveryCall);

  const stateQuery = useQuery({
    queryKey: ["booking-state", position ?? null],
    queryFn: () => loadState({ data: { positionId: position } }),
  });

  // Calendly confirms the chosen time by postMessage. Only then is a call real,
  // so only then do we mark it booked and leave the page.
  const handleScheduled = useCallback(async () => {
    const callId = callIdRef.current;
    if (callId) {
      try {
        await confirm({ data: { callId } });
      } catch {
        /* the requested row already exists; status catch-up is not worth blocking on */
      }
    }
    toast.success("Time confirmed — check your email for the invite. Your workspace is open.");
    await queryClient.invalidateQueries({ queryKey: ["booking-state"] });
    navigate({ to: "/client" });
  }, [confirm, navigate, queryClient]);

  useEffect(
    () =>
      onCalendlyEvent((name) => {
        if (name === "calendly.event_scheduled") void handleScheduled();
      }),
    [handleScheduled],
  );

  const openScheduler = useMutation({
    mutationFn: async () => {
      const result = await request({
        data: { positionId: position, timezone: timeZone, notes: notes.trim() || undefined },
      });
      if (result.ok) callIdRef.current = result.callId;
      // CRM capture is a best-effort backstop; the sales_calls row is the truth.
      void submitToCrm({
        formId: "book-a-call",
        email: "",
        answers: { notes: notes.trim(), position_id: position ?? null, source: "in-app book-call" },
      }).catch(() => undefined);
      return result;
    },
    onSuccess: async (result) => {
      // The native scheduler on /book is the single source of real availability.
      // A failed request row must never block someone from picking a time.
      if (!result.ok) toastError(result);
      navigate({ to: "/book", search: { cta: "in-app" } });
    },
    onError: () => toast.error("We couldn't start your booking. Please try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: (callId: string) => cancel({ data: { callId } }),
    onSuccess: async () => {
      toast.success("Call request cancelled.");
      await queryClient.invalidateQueries({ queryKey: ["booking-state"] });
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't cancel. Nothing was saved — please try again." }),
  });

  const booked = stateQuery.data?.call ?? null;
  const role = stateQuery.data?.position ?? null;
  const schedulerVisible = embedState === "ready";

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Talk it through first</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Book a 30-minute call in our live diary. Your workspace is already open — the role stays
        saved as a draft{PAYMENTS_ENABLED ? " with payment pending" : ""} until we agree the plan
        together.
      </p>

      {stateQuery.isLoading && !stateQuery.data ? (
        <Skeleton className="mt-8 h-72 w-full rounded-xl" aria-busy="true" />
      ) : stateQuery.isError && !stateQuery.data ? (
        <Card className="mt-8">
          <CardContent className="space-y-4 py-10 text-center text-sm text-muted-foreground">
            <p>We couldn't load your booking details. Nothing you did was lost.</p>
            <Button variant="outline" onClick={() => void stateQuery.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : booked ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4" aria-hidden />
              Your call request is with us
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-medium">
                Requested {formatFull(booked.scheduledStart, timeZone)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                30 minutes · the time you chose in the scheduler is confirmed by email
              </p>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">What happens next</p>
              <p>We review your brief before the call, so we arrive with a plan, not questions.</p>
              <p>
                {PAYMENTS_ENABLED
                  ? "After the call you either pay and go live, or we approve the start and invoice you."
                  : "On the call we agree the plan and set the search live. Your workspace is open in the meantime."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate({ to: "/client" })}>
                {PAYMENTS_ENABLED ? "Go to your workspace" : "Go to my dashboard"}
              </Button>
              <Button variant="outline" asChild>
                <a href={CALENDLY_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  Change your time
                  <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                </a>
              </Button>
              {PAYMENTS_ENABLED && role ? (
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/checkout", search: { position: role.id } })}
                >
                  Pay now instead
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={() => cancelMutation.mutate(booked.id)}
                disabled={cancelMutation.isPending}
              >
                Cancel this call
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Choose a time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={schedulerVisible ? "hidden" : undefined}>
                <label htmlFor="call-notes" className="mb-1 block text-sm font-medium">
                  Anything we should read first? (optional)
                </label>
                <Textarea
                  id="call-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Budget constraints, timing, previous agencies…"
                />
              </div>

              {!schedulerVisible ? (
                <Button
                  onClick={() => openScheduler.mutate()}
                  disabled={openScheduler.isPending}
                >
                  {openScheduler.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Opening
                      scheduler…
                    </>
                  ) : (
                    "Open the scheduler"
                  )}
                </Button>
              ) : null}

              {/* The scheduler renders in place, so picking a time is never
                  interrupted by a redirect or blocked by a popup blocker. */}
              <div
                ref={embedRef}
                aria-label="Booking calendar"
                className={
                  schedulerVisible
                    ? "min-h-[680px] w-full overflow-hidden rounded-lg border"
                    : "hidden"
                }
              />

              {embedState === "unavailable" ? (
                <div className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
                  <p className="font-medium text-warning-foreground">
                    The calendar couldn't load in this browser.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    An extension or network policy is blocking it. Your request is saved — pick your
                    time directly instead.
                  </p>
                  <Button className="mt-3" asChild>
                    <a href={CALENDLY_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                      Open the booking page
                      <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                    </a>
                  </Button>
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Times are shown in your local time zone ({timeZone}) inside the scheduler, and every
                slot is one we actually hold.
              </p>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PhoneCall className="h-4 w-4" aria-hidden />
                While you wait
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Your workspace is open now — add the role detail and we'll read it before we talk.</p>
              <Button variant="outline" onClick={() => navigate({ to: "/client" })}>
                Go to your workspace
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
