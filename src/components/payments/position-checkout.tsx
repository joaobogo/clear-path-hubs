import { useCallback, useMemo, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createPositionCheckoutSession } from "@/lib/payments.functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  positionId: string;
  returnUrl: string;
}

export function PositionCheckout({ positionId, returnUrl }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await createPositionCheckoutSession({
      data: { positionId, returnUrl, environment: getStripeEnvironment() },
    });
    if ("error" in result) {
      setError(result.error);
      throw new Error(result.error);
    }
    if (!result.clientSecret) {
      const message = "Checkout could not be started. No payment was taken.";
      setError(message);
      throw new Error(message);
    }
    setError(null);
    return result.clientSecret;
  }, [positionId, returnUrl]);

  const options = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>We couldn't open checkout</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          <p className="text-sm">
            Your role is saved as a draft — nothing was lost and no card was charged.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div id="checkout" key={`${positionId}-${attempt}`}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
