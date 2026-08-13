import { clientStageLabel } from "@/lib/client-stage-labels";
import { toFitPresentation } from "@/lib/client-fit-presentation";
import { Link } from "@tanstack/react-router";
import { NotCurrentChip } from "@/components/client/degraded-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Building2,
  Clock,
  DollarSign,
  Globe2,
  TrendingUp,
  Users,
  CheckCircle2,
} from "lucide-react";
import type { ExecutiveReport } from "@/lib/executive.functions";

// ── Finance strip ─────────────────────────────────────────────────────────

function fmtMoney(cents: number | null, currency: string | null): string {
  if (cents == null) return "—";
  const cur = currency || "USD";
  const value = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${cur} ${Math.round(value).toLocaleString()}`;
  }
}

export function FinanceStrip({
  fin,
  notCurrent = false,
  notCurrentReason,
}: {
  fin: ExecutiveReport["finance_summary"];
  notCurrent?: boolean;
  notCurrentReason?: string | null;
}) {
  const tiles = [
    { label: "Hires · 30d", value: String(fin.hires_30d), icon: CheckCircle2 },
    { label: "Hires · 90d", value: String(fin.hires_90d), icon: TrendingUp },
    { label: "Hires · YTD", value: String(fin.hires_ytd), icon: TrendingUp },
    { label: "Open offers", value: String(fin.open_offers), icon: DollarSign },
    {
      label: "Open offer value",
      value: fmtMoney(fin.open_offer_value_cents, fin.salary_currency),
      icon: DollarSign,
    },
    {
      label: "Avg salary (offered)",
      value: fmtMoney(fin.avg_salary_cents, fin.salary_currency),
      icon: DollarSign,
    },
    {
      label: "Projected hires · next 30d",
      value: String(fin.projected_hires_next_30d),
      icon: TrendingUp,
    },
  ];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4" /> Finance-ready hiring summary
          {notCurrent && <NotCurrentChip reason={notCurrentReason} className="ml-1" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border bg-card/50 p-3">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                <t.icon className="h-3 w-3" /> {t.label}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">
                {notCurrent ? "\u2014" : t.value}
              </div>
            </div>
          ))}
        </div>
        {notCurrent && (
          <p className="mt-3 text-xs text-muted-foreground">
            {notCurrentReason ?? "This section is out of date"} — figures are withheld rather than
            shown as zero.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Regions ────────────────────────────────────────────────────────────────

export function RegionCard({ rows }: { rows: ExecutiveReport["open_by_region"] }) {
  const maxOpen = Math.max(1, ...rows.map((r) => r.open));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe2 className="h-4 w-4" /> Open roles by region
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No roles yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.slice(0, 12).map((r) => (
              <li key={r.region} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.region}</span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="text-foreground">{r.open}</span> open · {r.filled} filled · {r.total} total
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(r.open / maxOpen) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Bottlenecks ────────────────────────────────────────────────────────────

export function BottlenecksCard({ rows }: { rows: ExecutiveReport["bottlenecks"] }) {
  const styleFor = (sev: string) =>
    sev === "crit"
      ? "border-destructive/40 bg-destructive/5"
      : sev === "warn"
        ? "border-warning/40 bg-warning/5"
        : "border-border bg-card/40";
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" /> Action bottlenecks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing blocking flow right now.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((b) => (
              <li
                key={b.key}
                className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${styleFor(b.severity)}`}
              >
                <div>
                  <div className="text-sm font-medium">{b.label}</div>
                  <div className="text-xs text-muted-foreground">{b.hint}</div>
                </div>
                <div className="text-lg font-semibold tabular-nums">{b.count}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Pipeline by BU ─────────────────────────────────────────────────────────

export function PipelineByBU({ rows }: { rows: ExecutiveReport["pipeline_by_bu"] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" /> Pipeline health by business unit
        </CardTitle>
      </CardHeader>
      <CardContent className="taas-stack-scroll overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No business units in play yet. Add a department to your positions.
          </p>
        ) : (
          <table className="taas-stack-table w-full text-sm">
            <thead>
              <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 text-left font-medium">Business unit</th>
                <th className="py-2 text-right font-medium">Open roles</th>
                <th className="py-2 text-right font-medium">Active</th>
                <th className="py-2 text-right font-medium">Delivered</th>
                <th className="py-2 text-right font-medium">Shortlisted</th>
                <th className="py-2 text-right font-medium">Hired</th>
                <th className="py-2 text-right font-medium">Blocked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.business_unit} className="border-b last:border-0">
                  <td data-label="Business unit" className="py-2 font-medium">{r.business_unit}</td>
                  <td data-label="Open roles" className="py-2 text-right tabular-nums max-sm:text-left">{r.open_roles}</td>
                  <td data-label="Active" className="py-2 text-right tabular-nums max-sm:text-left">{r.active_candidates}</td>
                  <td data-label="Delivered" className="py-2 text-right tabular-nums max-sm:text-left">{r.delivered}</td>
                  <td data-label="Shortlisted" className="py-2 text-right tabular-nums max-sm:text-left">{r.shortlisted}</td>
                  <td data-label="Hired" className="py-2 text-right tabular-nums max-sm:text-left">{r.hired}</td>
                  <td data-label="Blocked" className="py-2 text-right tabular-nums max-sm:text-left">
                    {r.blocked > 0 ? (
                      <Badge variant="destructive">{r.blocked}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Time in stage ──────────────────────────────────────────────────────────

export function TimeInStageCard({ rows }: { rows: ExecutiveReport["time_in_stage"] }) {
  const maxP90 = Math.max(1, ...rows.map((r) => r.p90_days));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Time in stage
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active candidates in stages yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.stage} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">
                    {clientStageLabel(r.stage)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.count} candidates · avg <span className="text-foreground">{r.avg_days}d</span> · p90 <span className="text-foreground">{r.p90_days}d</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${r.p90_days > 14 ? "bg-destructive" : r.p90_days > 7 ? "bg-warning/10" : "bg-primary"}`}
                    style={{ width: `${(r.p90_days / maxP90) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Velocity + quality ─────────────────────────────────────────────────────

export function VelocityCard({
  delivery,
  quality,
}: {
  delivery: ExecutiveReport["delivery_velocity"];
  quality: ExecutiveReport["shortlist_quality"];
}) {
  const maxDeliv = Math.max(1, ...delivery.map((d) => d.delivered));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Delivery velocity & shortlist quality
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Candidates delivered per week (last 8)
          </div>
          <div className="flex items-end gap-1.5">
            {delivery.map((d) => (
              <div key={d.week_start} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{
                    height: `${Math.max(4, (d.delivered / maxDeliv) * 72)}px`,
                  }}
                  title={`${d.delivered} delivered`}
                />
                <div className="text-[10px] tabular-nums text-muted-foreground">
                  {d.label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            Typical shortlist fit per week (approved)
          </div>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {quality.map((q) => (
              <li
                key={q.week_start}
                className="rounded-md border bg-card/40 p-1.5 text-center"
                title={`${q.count} candidate${q.count === 1 ? "" : "s"} delivered`}
              >
                <div className="text-[10px] text-muted-foreground">{q.label}</div>
                <div className="text-[11px] font-semibold leading-tight">
                  {q.avg_score == null
                    ? "—"
                    : toFitPresentation(null, Number(q.avg_score)).headline}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function FooterLine({ generated_at }: { generated_at: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      Generated {new Date(generated_at).toLocaleString()} · Numbers are live from your
      workspace. See <Link to="/client/offers" className="underline">Offers</Link>,{" "}
      <Link to="/client/positions" className="underline">Roles</Link>, and{" "}
      <Link to="/client/candidates" className="underline">Candidates</Link> for drill-through.
    </p>
  );
}
