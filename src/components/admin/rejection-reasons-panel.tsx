// Reason counts for rejections and declines on one position (or client org).
// Counts come from the same decision rows shown underneath, so the two always
// reconcile. No inference: rows without a reason are reported as such.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRejectionReasonSummary } from "@/lib/rejection-reasons.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";

export function RejectionReasonsPanel({
  positionId,
  organizationId,
}: {
  positionId?: string;
  organizationId?: string;
}) {
  const fn = useServerFn(getRejectionReasonSummary);
  const q = useQuery({
    queryKey: ["rejection-reasons", positionId ?? null, organizationId ?? null],
    queryFn: () =>
      fn({
        data: {
          ...(positionId ? { position_id: positionId } : {}),
          ...(organizationId ? { organization_id: organizationId } : {}),
        },
      }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Rejection reasons</CardTitle>
        {q.data ? (
          <span className="text-xs text-muted-foreground">
            {q.data.total_decisions} decision{q.data.total_decisions === 1 ? "" : "s"}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <PanelState
          query={q}
          isEmpty={(q.data?.total_decisions ?? 0) === 0}
          empty={<PanelEmpty title="No rejections recorded" />}
        >
          {q.data && (
            <>
              <ul className="divide-y">
                {q.data.reasons.map((r) => (
                  <li key={r.code ?? "none"} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm">{r.label}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">us {r.admin}</Badge>
                      <Badge variant="outline">client {r.client}</Badge>
                      <span className="w-8 text-right text-sm font-semibold text-foreground">
                        {r.total}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {q.data.unattributed > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {q.data.unattributed} older decision
                  {q.data.unattributed === 1 ? "" : "s"} carry no structured reason. New rejections
                  always require one.
                </p>
              ) : null}
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Most recent
                </p>
                <ul className="space-y-2">
                  {q.data.recent.slice(0, 6).map((d) => (
                    <li key={d.decision_id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{d.reason_label}</span>
                      {" · "}
                      {d.surface === "client" ? "client decision" : "our decision"}
                      {d.stage_at_decision ? ` · at ${d.stage_at_decision.replace(/_/g, " ")}` : ""}
                      {" · "}
                      {new Date(d.created_at).toLocaleDateString()}
                      {d.detail ? <span className="block">{d.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </PanelState>
      </CardContent>
    </Card>
  );
}
