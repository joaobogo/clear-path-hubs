import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Check, Loader2, PhoneCall } from "lucide-react";
import {
  bookDiscoveryCall,
  cancelDiscoveryCall,
  getBookingState,
  listCallSlots,
} from "@/lib/booking.functions";
import {
  countdownTo,
  formatSlotFull,
  formatSlotTime,
  groupByDay,
  localTimeZone,
} from "@/lib/booking/slots";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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

function BookCallPage() {
  const { position } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const timeZone = useMemo(() => localTimeZone(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const loadSlots = useServerFn(listCallSlots);
  const loadState = useServerFn(getBookingState);
  const book = useServerFn(bookDiscoveryCall);
  const cancel = useServerFn(cancelDiscoveryCall);

  const stateQuery = useQuery({
    queryKey: ["booking-state", position ?? null],
    queryFn: () => loadState({ data: { positionId: position } }),
  });

  const slotsQuery = useQuery({
    queryKey: ["call-slots"],
    queryFn: () => loadSlots(),
    enabled: !stateQuery.data?.call,
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      book({
        data: {
          positionId: position as string,
          startIso: selected as string,
          timezone: timeZone,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message);
        await queryClient.invalidateQueries({ queryKey: ["call-slots"] });
        setSelected(null);
        return;
      }
      toast.success("Your call is booked. Your workspace is open now.");
      await queryClient.invalidateQueries({ queryKey: ["booking-state"] });
    },
    onError: () => toast.error("We couldn't book that call. Please try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: (callId: string) => cancel({ data: { callId } }),
    onSuccess: async () => {
      toast.success("Call cancelled.");
      await queryClient.invalidateQueries({ queryKey: ["booking-state"] });
      await queryClient.invalidateQueries({ queryKey: ["call-slots"] });
    },
  });

  const booked = stateQuery.data?.call ?? null;
  const role = stateQuery.data?.position ?? null;
  const days = useMemo(
    () => groupByDay(slotsQuery.data?.slots ?? [], timeZone).slice(0, 7),
    [slotsQuery.data, timeZone],
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Talk it through first</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Pick a 30-minute slot with our team. Your workspace is already open — the role stays saved
        as a draft with payment pending until we agree the plan together.
      </p>

      {stateQuery.isLoading ? (
        <Skeleton className="mt-8 h-72 w-full rounded-xl" />
      ) : booked ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4" aria-hidden />
              Your call is booked
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <p className="text-sm font-medium">{formatSlotFull(booked.scheduledStart, timeZone)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {countdownTo(booked.scheduledStart)} · 30 minutes · we'll call you
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
              {slotsQuery.isLoading ? (
                <Skeleton className="h-64 w-full rounded-lg" />
              ) : days.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No times are open right now. Email hello@taasflow.com and we'll find one.
                </p>
              ) : (
                days.map((day) => (
                  <div key={day.dayKey}>
                    <p className="mb-2 text-sm font-medium">{day.dayLabel}</p>
                    <div className="flex flex-wrap gap-2">
                      {day.slots.map((slot) => (
                        <Button
                          key={slot.start}
                          type="button"
                          size="sm"
                          variant={selected === slot.start ? "default" : "outline"}
                          aria-pressed={selected === slot.start}
                          onClick={() => setSelected(slot.start)}
                        >
                          {formatSlotTime(slot.start, timeZone)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}

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
                disabled={!selected || !position || bookMutation.isPending}
                onClick={() => bookMutation.mutate()}
              >
                {bookMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Booking…
                  </>
                ) : (
                  "Book this time"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Times shown in your local time zone ({timeZone}).
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
              {role ? (
                <div>
                  <Badge variant="outline">Payment pending</Badge>
                  <p className="mt-2">
                    <span className="font-medium text-foreground">{role.title}</span> is saved. It
                    goes live once payment clears or we approve the start.
                  </p>
                </div>
              ) : null}
              <p>Your workspace is open now — invite your team and set your criteria.</p>
              <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/client" })}>
                Open your workspace
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
