import { LayoutDashboard } from "lucide-react";
import { formatMoneyFromCents } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequestDialog } from "@/components/client/dashboards/request-dialog";
import { formatEnumLabel } from "@/lib/human-labels";

export function CustomRequestCard({
  orgId,
  openRequest,
}: {
  orgId: string;
  openRequest: {
    status: string;
    description: string;
    quoteAmountCents: number | null;
    quoteCurrency: string;
    quoteNote: string | null;
  } | null;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutDashboard className="h-4 w-4" /> Need something these blocks don't cover?
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            We build scoped dashboards to order. You see the price before any work starts.
          </p>
        </div>
        {!openRequest && <RequestDialog orgId={orgId} />}
      </CardHeader>
      {openRequest && (
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">"{openRequest.description}"</p>
          <p>
            Status: <span className="font-medium">{formatEnumLabel(openRequest.status)}</span>
            {openRequest.quoteAmountCents != null && (
              <>
                {" · "}Quoted{" "}
                <span className="font-medium">
                  {formatMoneyFromCents(
                    openRequest.quoteAmountCents,
                    openRequest.quoteCurrency,
                  )}
                </span>
              </>
            )}
          </p>
          {openRequest.quoteNote && (
            <p className="text-muted-foreground">{openRequest.quoteNote}</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
