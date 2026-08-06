/**
 * Account-level operating summary for /admin/clients/$id.
 *
 * Read-only aggregation across commercial and delivery state. Each block owns
 * its own query so one failing block cannot blank the page. No health score,
 * no churn prediction — every figure links to the screen it came from.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { PanelState, PanelEmpty } from "@/components/admin/panel-state";
import {
  getAccountCommercial,
  getAccountDelivery,
  getAccountEngagement,
} from "@/lib/admin-account-view.functions";
import { formatMoney, formatWhen } from "@/lib/admin-account-view";

type TabKey =
  | "access"
  | "positions"
  | "candidates"
  | "readiness";

function BlockShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}


function Figure({
  label,
  value,
  hint,
  to,
  search,
}: {
  label: string;
  value: string | number;
  hint?: string;
  to?: string;
  search?: Record<string, unknown>;
}) {
  const body = (
    <>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </>
  );
  if (!to) return <div className="rounded-md border p-3">{body}</div>;
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search={search as any}
      className="group rounded-md border p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      {body}
      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Open records <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  );
}

export function AccountOperatingSummary({
  organizationId,
  onOpenTab,
}: {
  organizationId: string;
  onOpenTab: (tab: TabKey) => void;
}) {
  const commercial = useQuery({
    queryKey: ["account-commercial", organizationId],
    queryFn: () => getAccountCommercial({ data: { organization_id: organizationId } }),
  });
  const delivery = useQuery({
    queryKey: ["account-delivery", organizationId],
    queryFn: () => getAccountDelivery({ data: { organization_id: organizationId } }),
  });
  const engagement = useQuery({
    queryKey: ["account-engagement", organizationId],
    queryFn: () => getAccountEngagement({ data: { organization_id: organizationId } }),
  });

  const noActivity =
    delivery.isSuccess &&
    commercial.isSuccess &&
    engagement.isSuccess &&
    delivery.data.open_roles === 0 &&
    delivery.data.filled_roles === 0 &&
    delivery.data.candidates_in_pipeline === 0 &&
    delivery.data.decisions_pending === 0 &&
    delivery.data.sla_breaches === 0 &&
    !commercial.data.subscription_status &&
    !commercial.data.last_payment &&
    !engagement.data.last_update_sent_at &&
    engagement.data.open_support_sessions === 0;

  if (noActivity) {
    return <PanelEmpty title="This account has no activity yet" />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3" data-qa-action="account-operating-summary">
      <BlockShell
        title="Commercial"
        action={
          <Button size="sm" variant="ghost" onClick={() => onOpenTab("access")}>
            Access tab
          </Button>
        }
      >
        {commercial.isPending ? (
          <BlockSkeleton />
        ) : commercial.isError ? (
          <BlockError onRetry={() => void commercial.refetch()} />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{commercial.data.plan_label ?? "No plan"}</span>
              {commercial.data.subscription_status ? (
                <Badge variant="outline" className="capitalize">
                  {commercial.data.subscription_status.replace(/_/g, " ")}
                </Badge>
              ) : null}
              {commercial.data.cancel_at_period_end ? (
                <Badge variant="secondary">cancels at period end</Badge>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Figure
                label="Seats used"
                value={`${commercial.data.seats_used} / ${commercial.data.seats_limit}`}
                hint={`${commercial.data.seats_remaining} remaining`}
              />
              <Figure
                label="Role allowance"
                value={
                  commercial.data.roles_total === null
                    ? "—"
                    : `${commercial.data.roles_used ?? 0} / ${commercial.data.roles_total}`
                }
                hint={
                  commercial.data.current_period_end
                    ? `Period ends ${formatWhen(commercial.data.current_period_end)}`
                    : undefined
                }
              />
            </div>
            <div className="rounded-md border p-3 text-sm">
              <div className="text-xs text-muted-foreground">Last payment</div>
              {commercial.data.last_payment ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {formatMoney(
                      commercial.data.last_payment.amount_cents,
                      commercial.data.last_payment.currency,
                    )}
                  </span>
                  <Badge variant="outline" className="capitalize">
                    {commercial.data.last_payment.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(commercial.data.last_payment.at)}
                  </span>
                  <Link
                    to="/admin/payments"
                    className="text-xs text-primary hover:underline"
                  >
                    Payments
                  </Link>
                </div>
              ) : (
                <p className="mt-0.5 text-muted-foreground">No payments recorded</p>
              )}
            </div>
          </div>
        )}
      </BlockShell>

      <BlockShell
        title="Delivery"
        action={
          <Button size="sm" variant="ghost" onClick={() => onOpenTab("positions")}>
            Positions
          </Button>
        }
      >
        {delivery.isPending ? (
          <BlockSkeleton rows={4} />
        ) : delivery.isError ? (
          <BlockError onRetry={() => void delivery.refetch()} />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onOpenTab("positions")}
              className="rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="text-xs text-muted-foreground">Open roles</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">
                {delivery.data.open_roles}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {delivery.data.filled_roles} filled
              </div>
            </button>
            <button
              type="button"
              onClick={() => onOpenTab("candidates")}
              className="rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="text-xs text-muted-foreground">Candidates in pipeline</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">
                {delivery.data.candidates_in_pipeline}
              </div>
            </button>
            <Figure
              label="Decisions pending"
              value={delivery.data.decisions_pending}
              hint="Submitted, awaiting the client"
              to="/admin/operations"
            />
            <Figure
              label="SLA breaches"
              value={delivery.data.sla_breaches}
              hint="Commitments already missed"
              to="/admin/sla"
            />
          </div>
        )}
      </BlockShell>

      <BlockShell
        title="Account contact"
        action={
          <Button size="sm" variant="ghost" onClick={() => onOpenTab("readiness")}>
            Update readiness check
          </Button>
        }
      >
        {engagement.isPending ? (
          <BlockSkeleton rows={2} />
        ) : engagement.isError ? (
          <BlockError onRetry={() => void engagement.refetch()} />
        ) : (
          <div className="space-y-2">
            <div className="rounded-md border p-3 text-sm">
              <div className="text-xs text-muted-foreground">Last update sent</div>
              <div className="mt-0.5 font-medium">
                {formatWhen(engagement.data.last_update_sent_at)}
              </div>
              {engagement.data.last_update_sent_by ? (
                <div className="text-[11px] text-muted-foreground">
                  by {engagement.data.last_update_sent_by}
                </div>
              ) : null}
            </div>
            <Link
              to="/admin/support"
              className="block rounded-md border p-3 text-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="text-xs text-muted-foreground">Open support sessions</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">
                {engagement.data.open_support_sessions}
              </div>
              {engagement.data.oldest_open_support_session_at ? (
                <div className="text-[11px] text-muted-foreground">
                  Oldest started {formatWhen(engagement.data.oldest_open_support_session_at)}
                </div>
              ) : null}
            </Link>
          </div>
        )}
      </BlockShell>
    </div>
  );
}
