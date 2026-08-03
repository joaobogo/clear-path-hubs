import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2, PhoneCall } from "lucide-react";
import {
  cancelDiscoveryCall,
  getBookingState,
  requestDiscoveryCall,
} from "@/lib/booking.functions";
import { openCalendlyPopup } from "@/lib/calendly";
import { submitToCrm } from "@/lib/crm/submit-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/book-call")({
  validateSearch: (search: Record<string, unknown>) => ({
    position: typeof search.position === "string" ? search.position : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book a call — talk before you pay | TaaSFlow" },
      {
        name: "description",
        content:
          "Pick a time to talk through your role with our team. Your workspace opens straight away and payment stays pending until we agree the plan.",
      },
      { property: "og:title", content: "Book a call — talk before you pay | TaaSFlow" },
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

function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatFull(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
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

  const loadState = useServerFn(getBookingState);
  const request = useServerFn(requestDiscoveryCall);
  const cancel = useServerFn(cancelDiscoveryCall);

  const stateQuery = useQuery({
    queryKey: ["booking-state", position ?? null],
    queryFn: () => loadState({ data: { positionId: position } }),
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const result = await request({
        data: { positionId: position, timezone: timeZone, notes: notes.trim() || undefined },
      });
      // CRM capture is a best-effort backstop; the sales_calls row is the truth.
      void submitToCrm({
        formId: "book-a-call",
        email: "",
        answers: { notes: notes.trim(), position_id: position ?? null, source: "in-app book-call" },
      }).catch(() => undefined);
      await openCalendlyPopup();
      return result;
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Pick your time in the scheduler — we've saved your notes.");
      await queryClient.invalidateQueries({ queryKey: ["booking-state"] });
    },
    onError: () => toast.error("We couldn't open the scheduler. Please try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: (callId: string) => cancel({ data: { callId } }),
    onSuccess: async () => {
      toast.success("Call request cancelled.");
      await queryClient.invalidateQueries({ queryKey: ["booking-state"] });
    },
  });

  const booked = stateQuery.data?.call ?? null;
  const role = stateQuery.data?.position ?? null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Talk it through first</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Book a 30-minute call in our live diary. Your workspace is already open — the role stays
        saved as a draft with payment pending until we agree the plan together.
      </p>

      {stateQuery.isLoading ? (
        <Skeleton className="mt-8 h-72 w-full rounded-xl" />
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
                After the call you either pay and go live, or we approve the start and invoice you.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate({ to: "/client" })}>Go to your workspace</Button>
              <Button variant="outline" onClick={() => void openCalendlyPopup()}>
                Change your time
              </Button>
              {role ? (
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
              <div>
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

              <Button
                onClick={() => requestMutation.mutate()}
                disabled={requestMutation.isPending}
              >
                {requestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Opening scheduler…
                  </>
                ) : (
                  "Open the scheduler"
                )}
              </Button>
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
