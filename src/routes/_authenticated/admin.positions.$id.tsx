import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { PaymentExemptionDialog } from "@/components/admin/payment-exemption-dialog";
import { StructuredNotesPanel } from "@/components/admin/structured-notes-panel";
import { StageAgingPanel } from "@/components/admin/stage-aging-panel";
import { PositionBottleneckCard } from "@/components/admin/position-bottleneck-card";
import { PositionSourceQualityPanel } from "@/components/admin/source-quality-panels";
import { RejectionReasonsPanel } from "@/components/admin/rejection-reasons-panel";
import { PositionOfferTrackingPanel } from "@/components/admin/offer-hire-panel";

import {
  InterviewExceptionsBadge,
  InterviewExceptionsPanel,
} from "@/components/admin/interview-exceptions-panel";

import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getPosition,
  updatePosition,
  setPositionStatus,
  setPositionVisibility,
  saveScreeningQuestions,
  getPositionActivity,
  deletePosition,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  Trash2,
  Plus,
  ExternalLink,
  FileCheck2,
  Sparkles,
  ShieldAlert,
  ListChecks,
  Gauge,
  Users,
  History,
  Settings2,
  ShieldCheck,
  MoreHorizontal,
  NotebookPen,
  Radar,
} from "lucide-react";
import { JobQualityPanel } from "@/components/positions/JobQualityPanel";
import { GeneratedBlueprintPanel } from "@/components/positions/generated-blueprint-panel";
import { RoleMemoryPanel } from "@/components/role-memory-panel";
import { SourcingOpsPanel } from "@/components/positions/sourcing-ops-panel";

// Secondary panels are code-split; opening a role only pays for the overview.
const TAB_MODULE = () => import("@/components/admin/position-detail/tabs");
import { LifecycleBar } from "@/components/admin/position-detail/lifecycle-bar";
import { OverviewTab } from "@/components/admin/position-detail/overview-tab";
const RequirementsEditor = lazy(() => TAB_MODULE().then((m) => ({ default: m.RequirementsEditor })));
const ScreeningEditor = lazy(() => TAB_MODULE().then((m) => ({ default: m.ScreeningEditor })));
const BlueprintTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.BlueprintTab })));
const PipelineTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.PipelineTab })));
const ActivityTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.ActivityTab })));
const SettingsTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.SettingsTab })));
const AuditTab = lazy(() => TAB_MODULE().then((m) => ({ default: m.AuditTab })));

function TabFallback() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-5 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-32 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <span className="sr-only">Loading panel…</span>
    </div>
  );
}
import { useConfirmAction } from "@/components/ds";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TAB_IDS = [
  "overview","requirements","preferred","dealbreakers","screening","blueprint",
  "pipeline","sourcing","memory","activity","audit","settings",
] as const;

export const Route = createFileRoute("/_authenticated/admin/positions/$id")({
  // Tabs live in the URL so deep links and back/forward keep working.
  validateSearch: (search: Record<string, unknown>): { tab?: (typeof TAB_IDS)[number] } => {
    const raw = search.tab == null ? null : String(search.tab);
    if (raw && (TAB_IDS as readonly string[]).includes(raw)) {
      return { tab: raw as (typeof TAB_IDS)[number] };
    }
    return {};
  },
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-position", params.id],
      queryFn: () => getPosition({ data: { id: params.id } }),
      staleTime: 0, // Ensure we always fetch the latest data including backfilled timestamps
    });
    if (!d) throw notFound();
    return d;
  },
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Position not found.</div>
  ),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.positions.$id.tsx"),
  head: () => ({ meta: [{ title: "Position workspace · TaaSFlow admin" }] }),
  component: PositionWorkspace,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const TABS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "requirements", label: "Requirements", icon: FileCheck2 },
  { id: "preferred", label: "Preferred", icon: Sparkles },
  { id: "dealbreakers", label: "Dealbreakers", icon: ShieldAlert },
  { id: "screening", label: "Screening", icon: ListChecks },
  { id: "blueprint", label: "Scoring blueprint", icon: Gauge },
  { id: "pipeline", label: "Pipeline", icon: Users },
  { id: "sourcing", label: "Sourcing", icon: Radar },
  { id: "memory", label: "Memory & handoff", icon: NotebookPen },
  { id: "activity", label: "Activity", icon: History },
  { id: "audit", label: "Audit", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings2 },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  needs_clarification: "bg-warning/15 text-warning-foreground dark:text-warning-foreground",
  approved: "bg-info/15 text-info dark:text-info",
  active: "bg-success/15 text-success dark:text-success",
  paused: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

const STAGE_ORDER = [
  "new",
  "reviewing",
  "delivered",
  "shortlisted",
  "interview_process",
  "offer",
  "hired",
  "not_moving_forward",
  "archived",
] as const;

function labelFrom(entry: unknown): string {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = entry as any;
    return String(r.label ?? r.text ?? r.name ?? JSON.stringify(r));
  }
  return String(entry ?? "");
}

function toStringList(json: unknown): string[] {
  return (Array.isArray(json) ? json : []).map(labelFrom).filter(Boolean);
}

function fromStringList(lines: string): unknown[] {
  return lines
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ label }));
}

function PositionWorkspace() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-position", id],
    queryFn: () => getPosition({ data: { id } }),
  });
  const p = data!.position as Any;
  const screening = data!.screening as Any[];
  const matches = data!.matches as Any[];

  const { tab: tabParam } = Route.useSearch();
  const tab: TabId = tabParam ?? "overview";
  const navigate = Route.useNavigate();
  const setTab = (next: TabId) =>
    navigate({ search: (prev: { tab?: TabId }) => ({ ...prev, tab: next }), replace: true });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-position", id] });
    await router.invalidate();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
      <header className="space-y-3">
        {(p.organizations?.id ?? p.organization_id) ? (
          <Link
            to="/admin/clients/$id"
            params={{ id: p.organizations?.id ?? p.organization_id }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
          >
            <Building2 className="h-3.5 w-3.5" />
            {p.organizations?.name ?? "Client"}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {p.organizations?.name ?? "Client"}
          </span>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {p.title}
              </h1>
              <Badge className={STATUS_BADGE[p.status] ?? "bg-muted"}>
                {p.status.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline">{p.visibility}</Badge>
              <InterviewExceptionsBadge positionId={p.id} />
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {p.location && <span>{p.location}</span>}
              {p.work_model && <span>· {p.work_model}</span>}
              {p.employment_type && <span>· {p.employment_type.replace(/_/g, " ")}</span>}
              {p.seniority && <span>· {p.seniority}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PaymentExemptionDialog
              positionId={p.id}
              paymentStatus={(p as { payment_status?: string | null }).payment_status}
            />

            <Button asChild variant="outline" size="sm">
              <Link
                to="/admin/positions/$id/edit"
                params={{ id: p.id }}
                search={{ step: undefined }}
                data-qa-action="edit-position-wizard"
              >
                Edit position
              </Link>
            </Button>
            <LifecycleBar position={p} onDone={invalidate} includeVisibilityCheck={true} />
          </div>
        </div>
        <div className="mt-4">
          <JobQualityPanel
            positionId={p.id}
            editTo={{ to: "/admin/positions/$id/edit", positionId: p.id }}
          />
        </div>
      </header>

      <PositionBottleneckCard
        positionId={id}
        organizationId={p.organization_id ?? null}
        onOpenStage={() => setTab("pipeline")}
      />



      <nav
        role="tablist"
        aria-label="Position sections"
        className="flex flex-wrap gap-1 border-b"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              data-qa-action={`position-tab-${t.id}`}
              className={
                "inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-sm transition " +
                (active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <section>
        {tab === "overview" && (
          <div className="space-y-6">
            <GeneratedBlueprintPanel
              position={p}
              audience="admin"
              editTo={{ to: "/admin/positions/$id/edit", params: { id } }}
            />
            <OverviewTab position={p} matches={matches} screening={screening} />
          </div>
        )}

        <Suspense fallback={<TabFallback />}>
        {tab === "requirements" && (
          <RequirementsEditor
            positionId={id}
            field="requirements"
            title="Must-have requirements"
            hint="One requirement per line. These are treated as required in scoring."
            value={p.requirements}
          />
        )}
        {tab === "preferred" && (
          <RequirementsEditor
            positionId={id}
            field="preferred_requirements"
            title="Preferred criteria"
            hint="One item per line. Contributes to fit but never causes a fail."
            value={p.preferred_requirements}
          />
        )}
        {tab === "dealbreakers" && (
          <RequirementsEditor
            positionId={id}
            field="dealbreakers"
            title="Dealbreakers"
            hint="One dealbreaker per line. A single miss disqualifies the candidate."
            value={p.dealbreakers}
          />
        )}
        {tab === "screening" && (
          <ScreeningEditor positionId={id} questions={screening} />
        )}
        {tab === "blueprint" && (
          <BlueprintTab position={p} screening={screening} />
        )}
        {tab === "pipeline" && <PipelineTab matches={matches} positionId={id} />}
        {tab === "sourcing" && <SourcingOpsPanel positionId={id} />}
        {tab === "memory" && <RoleMemoryPanel positionId={id} canEdit={true} />}
        {tab === "activity" && (
          <div className="space-y-4">
            <ActivityTab id={id} />
            <StructuredNotesPanel
              targetKind="position"
              targetId={id}
              title="Recruiter notes for this role"
            />
          </div>
        )}
        {tab === "audit" && <AuditTab id={id} />}
        {tab === "settings" && <SettingsTab position={p} onDone={invalidate} />}
        </Suspense>
      </section>
    </div>
  );
}

