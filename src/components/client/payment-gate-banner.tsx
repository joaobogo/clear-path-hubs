import { Link } from "@tanstack/react-router";
import { Clock3, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  positionId: string;
  positionTitle: string;
  paymentStatus: string;
  /** ISO start of a booked call, if there is one. */
  callStart?: string | null;
};

/**
 * The workspace is open, the role is saved, and payment hasn't happened yet.
 * Says so plainly — no apology, no nagging.
 */
export function PaymentGateBanner({ positionId, positionTitle, paymentStatus, callStart }: Props) {
  if (["paid", "exempt", "covered", "refunded"].includes(paymentStatus)) return null;

  const callLabel = callStart
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(callStart))
    : null;

  return (
    <div className="rounded-xl border border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Clock3 className="h-4 w-4" aria-hidden />
            {positionTitle} — payment pending
          </p>
          <p className="mt-1 text-sm text-[color:var(--brand-navy)]/75">
            {callLabel
              ? `We're speaking on ${callLabel}. Everything here is yours to use now; the role goes live once payment clears or we approve the start.`
              : "The brief is saved and your workspace is open. The role goes live the moment payment clears."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to="/checkout" search={{ position: positionId }}>
              <CreditCard className="mr-2 h-4 w-4" aria-hidden />
              Pay and publish
            </Link>
          </Button>
          {!callStart ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/book-call" search={{ position: positionId }}>
                Book a call
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
