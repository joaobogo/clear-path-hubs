import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Shield, MapPin, Coins, Radar, GitBranch, Gauge, FileText } from "lucide-react";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

/**
 * RoleBlueprint — the ATS-grade "source of truth" for a requisition.
 *
 * Every candidate score, shortlist decision, and AI recommendation in the
 * workspace anchors back to the approved blueprint rendered here. When copy
 * elsewhere says "vs blueprint", this is that blueprint.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export interface RoleBlueprintProps {
  position: AnyRow;
  activity?: AnyRow[];
}

const RUBRIC_WEIGHTS = {
  must: 60,
  nice: 30,
  dealbreakers: 10,
} as const;

function toLabelList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((r) =>
      typeof r === "string"
        ? r
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((r as any)?.label ?? (r as any)?.name ?? (r as any)?.title ?? (r as any)?.text ?? ""),
    )
    .filter((s: string) => s && s.trim().length > 0);
}

function formatCompensation(comp: AnyRow): string | null {
  if (!comp || typeof comp !== "object") return null;
  const currency = comp.currency ?? "USD";
  const min = comp.min ?? comp.salary_min ?? comp.base_min;
  const max = comp.max ?? comp.salary_max ?? comp.base_max;
  const period = comp.period ?? comp.frequency ?? "year";
  if (min == null && max == null) {
    if (typeof comp.notes === "string") return comp.notes;
    return null;
  }
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  if (min != null && max != null) return `${fmt(Number(min))} – ${fmt(Number(max))} / ${period}`;
  if (min != null) return `from ${fmt(Number(min))} / ${period}`;
  return `up to ${fmt(Number(max))} / ${period}`;
}

function derivedSourcingChannels(position: AnyRow): { label: string; note: string }[] {
  const ctx = position.intake_context ?? {};
  const custom = Array.isArray(ctx.sourcing_channels)
    ? (ctx.sourcing_channels as unknown[]).map((c) =>
        typeof c === "string" ? { label: c, note: "Requested during intake" } : null,
      )
    : [];
  const filtered = custom.filter(Boolean) as { label: string; note: string }[];
  if (filtered.length > 0) return filtered;

  const seniority = String(position.seniority ?? "").toLowerCase();
  const workModel = String(position.work_model ?? "").toLowerCase();
  const base = [
    { label: "TaaSFlow Talent Memory", note: "Prior vetted candidates matched to this rubric" },
    { label: "LinkedIn direct outreach", note: "Targeted by must-have coverage" },
    { label: "Referral network", note: "Warm intros from prior hires" },
  ];
  if (/lead|principal|staff|director|vp|chief|head/.test(seniority)) {
    base.push({ label: "Executive communities", note: "Boutique groups for senior operators" });
  }
  if (/remote|hybrid/.test(workModel)) {
    base.push({ label: "Remote-first communities", note: "Distributed talent pools" });
  } else {
    base.push({ label: "Local market channels", note: "On-the-ground for onsite roles" });
  }
  return base;
}

function humanizeBlueprintAction(action: string): string {
  const map: Record<string, string> = {
    "position.submit": "Blueprint submitted for review",
    "position.status.update": "Status changed",
    "position.approved": "Blueprint approved",
    "position.published": "Position published",
    "position.updated": "Blueprint edited",
    "position.closed": "Position closed",
    "position.archived": "Position archived",
  };
  return map[action] ?? action.replace(/[._]/g, " ");
}

export function RoleBlueprint({ position, activity = [] }: RoleBlueprintProps) {
  const mustHaves = toLabelList(position.requirements);
  const nice = toLabelList(position.preferred_requirements);
  const dealbreakers = toLabelList(position.dealbreakers);
  const compensation = formatCompensation(position.compensation);
  const workAuth = Array.isArray(position.work_authorization)
    ? (position.work_authorization as string[]).join(", ")
    : (position.work_authorization?.notes ?? null);
  const channels = derivedSourcingChannels(position);
  const intakeNotes: string | null =
    position.intake_context?.notes ??
    position.intake_context?.context ??
    position.intake_context?.summary ??
    (typeof position.intake_context === "string" ? position.intake_context : null);

  const approvalTimeline: { label: string; at: string | null; done: boolean }[] = [
    { label: "Submitted", at: position.submitted_at, done: !!position.submitted_at },
    { label: "Approved", at: position.approved_at, done: !!position.approved_at },
    { label: "Published", at: position.published_at, done: !!position.published_at },
    { label: "Closed", at: position.closed_at, done: !!position.closed_at },
  ];

  const changeLog = (activity ?? [])
    .filter((a: AnyRow) => String(a.action ?? "").startsWith("position."))
    .slice(0, 8);

  const approved = !!position.approved_at;

  return (
    <section
      aria-label="Role blueprint"
      className="rounded-xl border bg-card overflow-hidden"
      data-qa="role-blueprint"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Role blueprint</h2>
            {approved ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Approved
              </Badge>
            ) : (
              <Badge variant="outline">In review</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The single source of truth for this role. Every candidate score, shortlist decision, and AI
            recommendation anchors back to what's on this page.
          </p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          Kept in sync with your approved brief
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Description */}
        {position.description ? (
          <div>
            <SectionLabel>Summary</SectionLabel>
            <p className="text-sm whitespace-pre-wrap text-foreground/90">{position.description}</p>
          </div>
        ) : null}

        {/* Requirements grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <RequirementColumn
            title="Must-have"
            tone="must"
            items={mustHaves}
            emptyHint="No must-haves listed yet"
          />
          <RequirementColumn
            title="Nice-to-have"
            tone="nice"
            items={nice}
            emptyHint="Optional signals not defined"
          />
          <RequirementColumn
            title="Dealbreakers"
            tone="deal"
            items={dealbreakers}
            emptyHint="No hard blockers set"
          />
        </div>

        {/* Facts strip */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FactTile
            icon={<MapPin className="h-4 w-4" />}
            label="Location & work model"
            primary={[position.location, position.work_model].filter(Boolean).join(" · ") || "Not set"}
            secondary={position.employment_type ? String(position.employment_type) : null}
          />
          <FactTile
            icon={<Coins className="h-4 w-4" />}
            label="Compensation range"
            primary={compensation ?? "Not disclosed"}
            secondary={position.compensation?.equity ? "Equity included" : null}
          />
          <FactTile
            icon={<Shield className="h-4 w-4" />}
            label="Work authorization"
            primary={workAuth || "As per local law"}
          />
          <FactTile
            icon={<Gauge className="h-4 w-4" />}
            label="Seniority"
            primary={position.seniority || "Unspecified"}
            secondary={position.department ? String(position.department) : null}
          />
        </div>

        {/* Scoring rubric preview */}
        <div>
          <SectionLabel>Scoring rubric preview</SectionLabel>
          <p className="text-xs text-muted-foreground mb-2">
            Every candidate score you see is computed against this weighting. Evidence in each candidate
            report cites the specific line item below.
          </p>
          <div className="rounded-lg border">
            <RubricRow
              label="Must-have coverage"
              count={mustHaves.length}
              weight={RUBRIC_WEIGHTS.must}
              tone="must"
            />
            <RubricRow
              label="Nice-to-have signal"
              count={nice.length}
              weight={RUBRIC_WEIGHTS.nice}
              tone="nice"
            />
            <RubricRow
              label="Dealbreaker checks"
              count={dealbreakers.length}
              weight={RUBRIC_WEIGHTS.dealbreakers}
              tone="deal"
              last
            />
          </div>
        </div>

        {/* Talent signals planned */}
        <div>
          <SectionLabel>
            <Radar className="mr-1.5 inline h-3.5 w-3.5" /> Talent signals planned
          </SectionLabel>
          <ul className="grid gap-2 sm:grid-cols-2">
            {channels.map((c, i) => (
              <li
                key={i}
                className="rounded-lg border bg-background/50 p-3 text-sm"
              >
                <div className="font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.note}</div>
              </li>
            ))}
          </ul>
        </div>

        {/* Intake notes */}
        {intakeNotes ? (
          <div>
            <SectionLabel>Intake notes</SectionLabel>
            <blockquote className="rounded-lg border-l-2 border-primary/40 bg-muted/30 px-4 py-3 text-sm text-foreground/90 whitespace-pre-wrap">
              {intakeNotes}
            </blockquote>
          </div>
        ) : null}

        {/* Approval history + change log */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionLabel>
              <Clock className="mr-1.5 inline h-3.5 w-3.5" /> Approval history
            </SectionLabel>
            <ol className="space-y-2">
              {approvalTimeline.map((t) => (
                <li
                  key={t.label}
                  className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                    t.done ? "bg-background" : "bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-3.5 w-3.5 ${t.done ? "text-emerald-600" : "text-muted-foreground/40"}`}
                    />
                    {t.label}
                  </span>
                  <span className="text-xs tabular-nums">
                    {t.at ? new Date(t.at).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE }) : "—"}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <SectionLabel>
              <GitBranch className="mr-1.5 inline h-3.5 w-3.5" /> Change log
            </SectionLabel>
            {changeLog.length === 0 ? (
              <div className="text-sm text-muted-foreground">No edits since approval.</div>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {changeLog.map((a: AnyRow) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="text-foreground/90">{humanizeBlueprintAction(a.action)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE }) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Anchored to this blueprint: every candidate score, shortlist call, and AI recommendation in this
          workspace references the approved brief shown above. Requesting a change opens a new revision —
          earlier assessments stay tied to the brief they were made against.
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </div>
  );
}

function RequirementColumn({
  title,
  tone,
  items,
  emptyHint,
}: {
  title: string;
  tone: "must" | "nice" | "deal";
  items: string[];
  emptyHint: string;
}) {
  const toneClass =
    tone === "must"
      ? "border-primary/40 bg-primary/5"
      : tone === "nice"
        ? "border-border bg-background"
        : "border-destructive/30 bg-destructive/5";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide">{title}</div>
        <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyHint}</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((s, i) => (
            <li key={i} className="flex gap-1.5">
              <span className="text-muted-foreground">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FactTile({
  icon,
  label,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary?: string | null;
}) {
  return (
    <div className="rounded-lg border bg-background/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-sm font-medium capitalize">{primary}</div>
      {secondary ? <div className="text-xs text-muted-foreground capitalize">{secondary}</div> : null}
    </div>
  );
}

function RubricRow({
  label,
  count,
  weight,
  tone,
  last,
}: {
  label: string;
  count: number;
  weight: number;
  tone: "must" | "nice" | "deal";
  last?: boolean;
}) {
  const bar =
    tone === "must"
      ? "bg-primary"
      : tone === "nice"
        ? "bg-emerald-500"
        : "bg-destructive/70";
  return (
    <div className={`flex items-center gap-4 px-3 py-2.5 ${last ? "" : "border-b"}`}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">
          {count} {count === 1 ? "line" : "lines"} in blueprint
        </div>
      </div>
      <div className="w-32">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${bar}`} style={{ width: `${weight}%` }} />
        </div>
      </div>
      <div className="w-12 text-right text-sm font-semibold tabular-nums">{weight}%</div>
    </div>
  );
}
