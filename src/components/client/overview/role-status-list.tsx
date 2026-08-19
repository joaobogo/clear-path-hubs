// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Briefcase, ChevronRight } from "lucide-react";
import { formatStageDate } from "@/lib/client-role-progress";
import { shortlistCommitment, formatCommitmentDate } from "@/lib/client-commitment";
import { roleNextStep } from "@/lib/client-role-next-step";
import { clientRoleStatusLabel } from "@/lib/client-role-status";
import { EmptyBlock } from "./section-primitives";

/**
 * Plain-language stage per role, with the date it entered that stage, how long
 * it has been there, and an "at risk" line derived only from real timing data.
 */
export function RoleStatusList({
  roles,
  loading,
  compact,
}: {
  roles: Any[];
  loading: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />
        ))}
      </div>
    );
  }
  if (roles.length === 0) {
    return (
      <EmptyBlock text="No live roles right now. Submit a role and its progress shows up here." />
    );
  }
  return (
    <ul className="grid gap-2 group-data-[density=compact]/container:gap-1.5">
      {roles.map((r) => {
        const since = formatStageDate(r.stage_entered_at);
        const days = r.days_in_stage as number | null;
        const commitment = shortlistCommitment({
          promisedShortlistBy: r.promised_shortlist_by,
          shortlistDeliveredAt: r.shortlist_delivered_at,
        });
        const next = roleNextStep(r);
        return (
          <li key={r.position_id}>
            <div
              className={`rounded-xl border bg-card transition ${
                r.at_risk ? "taas-bd-warning" : ""
              }`}
            >
              <Link
                to="/client/positions/$id"
                params={{ id: r.position_id }}
                className="group flex flex-col gap-2 hover:bg-muted/30 px-4 py-3.5 group-data-[density=compact]/container:py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-semibold group-hover:text-primary">
                        {r.title}
                      </span>
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {clientRoleStatusLabel(r.client_status)}
                      </span>
                    </div>
                    {/* Stage tiles hidden until H1 lands to resolve data inconsistency */}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.delivered_pending > 0 && (
                      <span className="rounded-full taas-bg-warning-soft px-2 py-0.5 text-[11px] font-semibold taas-fg-warning">
                        {r.delivered_pending} to review
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </div>

                {/* Our promise, next to what actually happened. Misses shown plainly. */}
                <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] sm:text-xs group-data-[density=compact]/container:hidden">
                    <div className="min-w-0">
                      <div className="text-muted-foreground">First shortlist promised</div>
                      <div className="truncate font-medium text-foreground">
                        {commitment.promisedAt
                          ? formatCommitmentDate(commitment.promisedAt)
                          : "Not committed"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-muted-foreground">Actual</div>
                      <div className="truncate font-medium text-foreground">
                        {commitment.actualAt
                          ? formatCommitmentDate(commitment.actualAt)
                          : "Not yet"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-muted-foreground">Variance</div>
                      <div
                        className={`truncate font-medium ${
                          commitment.state === "missed" || commitment.state === "overdue"
                            ? "taas-fg-danger"
                            : commitment.state === "met"
                              ? "taas-fg-success"
                              : "text-foreground"
                        }`}
                      >
                        {commitment.varianceLabel}
                      </div>
                    </div>
                  </div>

                {/* What happens next: owner and date, always stated. */}
                <p
                  className={`flex items-start gap-2 rounded-lg border border-dashed px-3 py-1.5 text-[11px] sm:text-xs ${
                    next.overdue
                      ? "taas-bd-warning taas-bg-warning-soft taas-fg-warning"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <span>
                    <span className="font-semibold text-foreground">Next: </span>
                    {next.sentence}{" "}
                    <span className="font-medium text-foreground">{next.ownerLabel}</span>
                    {next.dateLabel ? ` · by ${next.dateLabel}` : ""}
                  </span>
                </p>

                {r.at_risk && r.risk_reason && (
                  <p className="flex items-start gap-2 rounded-lg taas-bg-warning-soft px-3 py-2 text-xs taas-fg-warning sm:text-sm">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <span className="font-semibold">At risk — </span>
                      {r.risk_reason}
                    </span>
                  </p>
                )}
              </Link>
              <div className="border-t px-4 py-2">
                <Link
                  to="/client/candidates"
                  search={{ position: r.position_id, view: "compare" } as never}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Compare shortlist side by side →
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
