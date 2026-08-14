import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BLOCK_LIST } from "@/lib/dashboards/blocks";
import { RequestDialog } from "@/components/client/dashboards/request-dialog";
import { formatEnumLabel } from "@/lib/human-labels";

export function LockedPanel({
  reason,
  openRequest,
  orgId,
  canRequest,
}: {
  reason: string;
  openRequest: { status: string; description: string } | null;
  orgId: string;
  canRequest: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <Lock className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <CardTitle className="text-base">Personalised dashboards aren't on this account</CardTitle>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {BLOCK_LIST.map((b) => (
              <div key={b.id} className="rounded-md border p-3">
                <p className="text-sm font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.definition}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/client/account" search={{ tab: "plan" }}>See annual plans</Link>
            </Button>
            {canRequest && !openRequest && <RequestDialog orgId={orgId} />}
          </div>
          {openRequest && (
            <p className="text-sm text-muted-foreground">
              Your request is with us — status: {formatEnumLabel(openRequest.status)}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
