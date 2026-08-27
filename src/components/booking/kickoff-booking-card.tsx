/**
 * Kickoff call card — the intake → Calendly → workspace hand-off.
 *
 * Shown on the intake confirmation screen once the first role is saved. It
 * books into OUR Calendly (so the meeting lands on the real calendar and the
 * signed webhook records it), then takes the person straight into their
 * workspace — the role if we have it, otherwise the client home.
 *
 * When no Calendly link is configured we say nothing and point at the native
 * scheduler instead of rendering an empty widget.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CALENDLY_KICKOFF_URL } from "@/config/calendly";
import { BOOKING_ROUTE } from "@/config/booking";
import { CalendlyInline, type CalendlyScheduledEvent } from "@/components/booking/calendly-inline";
import { startKickoffBooking, type KickoffBooking } from "@/lib/booking/kickoff.functions";
import { confirmBookingScheduled } from "@/lib/booking/booking.functions";

type Props = {
  intakeId: string;
  /** Position to land on after scheduling, when it already exists. */
  positionId: string | null;
  roleTitle?: string | null;
};

export function KickoffBookingCard({ intakeId, positionId, roleTitle }: Props) {
  const navigate = useNavigate();
  const start = useServerFn(startKickoffBooking);
  const confirm = useServerFn(confirmBookingScheduled);
  const [booking, setBooking] = useState<KickoffBooking | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!CALENDLY_KICKOFF_URL || startedRef.current) return;
    startedRef.current = true;
    void start({ data: { intakeId } })
      .then((result) => setBooking(result))
      .catch(() => setBooking(null));
  }, [intakeId, start]);

  const goToWorkspace = () => {
    if (positionId) {
      void navigate({ to: "/client/positions/$id", params: { id: positionId } });
    } else {
      void navigate({ to: "/client" });
    }
  };

  const onScheduled = (event: CalendlyScheduledEvent) => {
    setScheduled(true);
    toast.success("Your kickoff call is booked", {
      description: "The invite is on its way by email. Taking you to your workspace…",
    });
    if (booking?.sessionId) {
      void confirm({
        data: {
          sessionId: booking.sessionId,
          calendlyEventUri: event.eventUri,
          calendlyInviteeUri: event.inviteeUri,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }).catch(() => undefined);
    }
    window.setTimeout(goToWorkspace, 2200);
  };

  if (!CALENDLY_KICKOFF_URL) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarCheck className="h-5 w-5" aria-hidden />
            Book your kickoff call
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Twenty minutes with the team that will run{" "}
            {roleTitle ? <span className="font-medium text-foreground">{roleTitle}</span> : "your role"}:
            we confirm the evidence bar and agree the shortlist date.
          </p>
          <Button asChild>
            <a href={BOOKING_ROUTE}>Pick a time</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarCheck className="h-5 w-5" aria-hidden />
          Book your kickoff call
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {scheduled ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
              Booked — the calendar invite is on its way.
            </p>
            <Button onClick={goToWorkspace}>Go to your workspace</Button>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              Twenty minutes to confirm the evidence bar for{" "}
              {roleTitle ? <span className="font-medium text-foreground">{roleTitle}</span> : "your role"}{" "}
              and agree your shortlist date. Pick a time and we'll take you into your workspace.
            </p>
            <CalendlyInline
              url={CALENDLY_KICKOFF_URL}
              prefill={{
                name: booking?.name ?? null,
                email: booking?.email ?? null,
                sessionId: booking?.sessionId ?? null,
                note: roleTitle ? `First role: ${roleTitle}` : null,
              }}
              onScheduled={onScheduled}
            />
            <Button variant="ghost" onClick={goToWorkspace} className="px-0">
              Skip for now — open my workspace
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
