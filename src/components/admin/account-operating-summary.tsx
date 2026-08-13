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

  // "No activity" is only honest when all three reads succeeded.
  const d = delivery.data;
  const c = commercial.data;
  const e = engagement.data;
  const noActivity =
    delivery.isSuccess &&
    commercial.isSuccess &&
    engagement.isSuccess &&
    !!d &&
    !!c &&
    !!e &&
    d.open_roles === 0 &&
    d.filled_roles === 0 &&
    d.candidates_in_pipeline === 0 &&
    d.decisions_pending === 0 &&
    d.sla_breaches === 0 &&
    !c.subscription_status &&
    !c.last_payment &&
    !e.last_update_sent_at &&
    e.open_support_sessions === 0;

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
        <PanelState query={commercial}>
          {(() => {
            const c = commercial.data;
            if (!c) return null;
            return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{c.plan_label ?? "No plan"}</span>
              {c.subscription_status ? (
                <Badge variant="outline" className="capitalize">
                  {c.subscription_status.replace(/_/g, " ")}
                </Badge>
              ) : null}
              {c.cancel_at_period_end ? (
                <Badge variant="secondary">cancels at period end</Badge>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Figure
                label="Seats used"
                value={`${c.seats_used} / ${c.seats_limit}`}
                hint={`${c.seats_remaining} remaining`}
              />
              <Figure
                label="Role allowance"
                value={
                  c.roles_total === null
                    ? "—"
                    : `${c.roles_used ?? 0} / ${c.roles_total}`
                }
                hint={
                  c.current_period_end
                    ? `Period ends ${formatWhen(c.current_period_end)}`
                    : undefined
                }
              />
            </div>
            <div className="rounded-md border p-3 text-sm">
              <div className="text-xs text-muted-foreground">Last payment</div>
              {c.last_payment ? (
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {formatMoney(
                      c.last_payment.amount_cents,
                      c.last_payment.currency,
                    )}
                  </span>
                  <Badge variant="outline" className="capitalize">
                    {c.last_payment.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(c.last_payment.at)}
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
            );
          })()}
        </PanelState>
      </BlockShell>

      <BlockShell
        title="Delivery"
        action={
          <Button size="sm" variant="ghost" onClick={() => onOpenTab("positions")}>
            Positions
          </Button>
        }
      >
        <PanelState query={delivery} skeletonRows={4}>
          {(() => {
            const d = delivery.data;
            if (!d) return null;
            return (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onOpenTab("positions")}
              className="rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="text-xs text-muted-foreground">Open roles</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">
                {d.open_roles}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {d.filled_roles} filled
              </div>
            </button>
            <button
              type="button"
              onClick={() => onOpenTab("candidates")}
              className="rounded-md border p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="text-xs text-muted-foreground">Candidates in pipeline</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">
                {d.candidates_in_pipeline}
              </div>
            </button>
            <Figure
              label="Decisions pending"
              value={d.decisions_pending}
              hint="Submitted, awaiting the client"
              to="/admin/operations"
            />
            <Figure
              label="SLA breaches"
              value={d.sla_breaches}
              hint="Commitments already missed"
              to="/admin/sla"
            />
          </div>
            );
          })()}
        </PanelState>
      </BlockShell>

      <BlockShell
        title="Account contact"
        action={
          <Button size="sm" variant="ghost" onClick={() => onOpenTab("readiness")}>
            Update readiness check
          </Button>
        }
      >
        <PanelState query={engagement} skeletonRows={2}>
          {(() => {
            const e = engagement.data!;
            return (
          <div className="space-y-2">
            <div className="rounded-md border p-3 text-sm">
              <div className="text-xs text-muted-foreground">Last update sent</div>
              <div className="mt-0.5 font-medium">
                {formatWhen(e.last_update_sent_at)}
              </div>
              {e.last_update_sent_by ? (
                <div className="text-[11px] text-muted-foreground">
                  by {e.last_update_sent_by}
                </div>
              ) : null}
            </div>
            <Link
              to="/admin/support"
              className="block rounded-md border p-3 text-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
            >
              <div className="text-xs text-muted-foreground">Open support sessions</div>
              <div className="mt-0.5 text-xl font-semibold tabular-nums">
                {e.open_support_sessions}
              </div>
              {e.oldest_open_support_session_at ? (
                <div className="text-[11px] text-muted-foreground">
                  Oldest started {formatWhen(e.oldest_open_support_session_at)}
                </div>
              ) : null}
            </Link>
          </div>
            );
          })()}
        </PanelState>
      </BlockShell>
    </div>
  );
}
