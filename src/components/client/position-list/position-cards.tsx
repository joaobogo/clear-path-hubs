import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { RoleProgressTracker } from "@/components/client/role-progress-tracker";
import type { RoleProgress } from "@/lib/client-role-progress";
import { SurfaceState } from "@/components/ds/surface-state";
import { resolveNoRolesState } from "@/lib/empty-states/empty-state-catalogue";
import {
  clientRoleStatusLabel,
  type ClientRoleStatus,
} from "@/lib/client-role-status";

export type Row = {
  id: string;
  title: string;
  status: string;
  location: string | null;
  work_model: string | null;
  employment_type: string | null;
  seniority: string | null;
  updated_at: string | null;
  kpis: {
    delivered: number;
    top: number;
    shortlisted: number;
    interviewing: number;
    interview_scheduled: number;
    hires: number;
    active_positions: number;
  };
  pipeline_line: string | null;
  progress: RoleProgress | null;
  client_status: ClientRoleStatus | null;
  next_milestone: string | null;
  action_required: string | null;
};

export function PortfolioSnapshot({
  data,
  loading,
}: {
  data: {
    active: number;
    delivered: number;
    shortlisted: number;
    interviewing: number;
    offers: number;
    hires: number;
  };
  loading: boolean;
}) {
  const tiles: Array<{ label: string; value: number; href?: string }> = [
    { label: "Active", value: data.active },
    {
      label: "Delivered",
      value: data.delivered,
      href: "/client/candidates?filter=new",
    },
    {
      label: "Shortlisted",
      value: data.shortlisted,
      href: "/client/candidates?filter=shortlisted",
    },
    {
      label: "Interview",
      value: data.interviewing,
      href: "/client/candidates?filter=interview",
    },
    { label: "Offers", value: data.offers },
    {
      label: "Hires",
      value: data.hires,
      href: "/client/candidates?filter=hired",
    },
  ];
  return (
    <section
      aria-label="Portfolio snapshot"
      className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
    >
      {tiles.map((t) => {
        const inner = (
          <div className="rounded-xl border bg-card p-3 transition-colors hover:border-primary/50">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              {loading ? "—" : t.value}
            </div>
          </div>
        );
        return t.href ? (
          <Link key={t.label} to={t.href} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
            {inner}
          </Link>
        ) : (
          <div key={t.label}>{inner}</div>
        );
      })}
    </section>
  );
}

export function PositionCard({ p }: { p: Row }) {
  const progress = p.pipeline_line ?? progressSummary(p);
  const total =
    p.kpis.delivered +
    p.kpis.shortlisted +
    p.kpis.interviewing +
    p.kpis.hires;
  const segments = [
    { key: "delivered", label: "Delivered", value: p.kpis.delivered, className: "taas-bg-info-soft" },
    { key: "shortlisted", label: "Shortlisted", value: p.kpis.shortlisted, className: "taas-bg-info-soft" },
    { key: "interviewing", label: "Interview", value: p.kpis.interviewing, className: "taas-bg-warning-soft" },
    { key: "hires", label: "Hires", value: p.kpis.hires, className: "taas-bg-success-soft" },
  ];
  return (
    <Link
      to="/client/positions/$id"
      params={{ id: p.id }}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold truncate group-hover:text-primary">
            {p.title}
          </h3>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {[p.location, p.work_model, p.seniority].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 whitespace-nowrap text-xs">
          {clientRoleStatusLabel(p.client_status)}
        </Badge>
      </div>

      <p className="text-sm text-foreground/80 min-h-[2.5rem]">{progress}</p>
      <RoleProgressTracker progress={p.progress} size="sm" className="pt-1" />

      <div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {total === 0 ? (
            <div className="w-full bg-muted" />
          ) : (
            segments.map((s) =>
              s.value > 0 ? (
                <div
                  key={s.key}
                  className={s.className}
                  style={{ width: `${(s.value / total) * 100}%` }}
                  aria-label={`${s.label}: ${s.value}`}
                  title={`${s.label}: ${s.value}`}
                />
              ) : null,
            )
          )}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
          {segments.map((s) => (
            <div key={s.key} className="min-w-0">
              <div className="text-muted-foreground truncate">{s.label}</div>
              <div className="tabular-nums font-medium">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {p.next_milestone ?? "—"}
        </div>
        {p.action_required && (
          <span className="rounded-full taas-bg-warning-soft px-2 py-0.5 taas-fg-warning ">
            {p.action_required}
          </span>
        )}
      </div>
    </Link>
  );
}

export function CompactList({ rows }: { rows: Row[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Position</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-right">Delivered</th>
              <th className="px-3 py-2 text-right">Shortlist</th>
              <th className="px-3 py-2 text-right">Interview</th>
              <th className="px-3 py-2 text-right">Hires</th>
              <th className="px-3 py-2 text-left">Next</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-t hover:bg-muted/30 focus-within:bg-muted/30"
              >
                <td className="px-4 py-2">
                  <Link
                    to="/client/positions/$id"
                    params={{ id: p.id }}
                    className="font-medium hover:underline"
                  >
                    {p.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {p.pipeline_line ?? progressSummary(p)}
                  </div>
                  {p.progress && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {p.progress.caption}
                    </div>
                  )}
                  {p.action_required && (
                    <div className="text-[11px] taas-fg-warning ">
                      {p.action_required}
                    </div>
                  )}

                </td>
                <td className="px-3 py-2">
                  <Badge variant="secondary" className="text-[11px]">
                    {clientRoleStatusLabel(p.client_status)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.location ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.kpis.delivered}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.kpis.shortlisted}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.kpis.interviewing}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.kpis.hires}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {p.next_milestone ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((p) => (
          <PositionCard key={p.id} p={p} />
        ))}
      </div>
    </>
  );
}

export function EmptyState({
  status,
  hasAnyRole,
  pendingSetup,
}: {
  status: string;
  hasAnyRole: boolean;
  pendingSetup: number;
}) {
  return (
    <SurfaceState content={resolveNoRolesState({ status, hasAnyRole, pendingSetup })} />
  );
}

export function progressSummary(p: Row): string {
  if (p.status === "draft") return "Under review by TaaSFlow. You will be notified when the search goes live.";
  if (p.status === "paused") return "This search is currently paused.";
  if (p.status === "closed" || p.status === "archived") return "This search is closed.";
  const k = p.kpis;
  if (k.hires > 0) return `${k.hires} hire${k.hires === 1 ? "" : "s"} confirmed. Hiring activity remains available.`;
  if (k.interviewing > 0)
    return `${k.interviewing} candidate${k.interviewing === 1 ? "" : "s"} in the interview process.`;
  if (k.shortlisted > 0)
    return `${k.shortlisted} shortlisted candidate${k.shortlisted === 1 ? "" : "s"} ready for interview requests.`;
  if (k.delivered > 0)
    return `${k.delivered} candidate${k.delivered === 1 ? "" : "s"} delivered${k.top > 0 ? `, ${k.top} top match${k.top === 1 ? "" : "es"}` : ""}. Waiting on your review.`;
  return "TaaSFlow is building the first shortlist for this role.";
}
