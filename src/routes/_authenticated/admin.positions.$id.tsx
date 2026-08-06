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

export const Route = createFileRoute("/_authenticated/admin/positions/$id")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-position", params.id],
      queryFn: () => getPosition({ data: { id: params.id } }),
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

  const [tab, setTab] = useState<TabId>("overview");

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-position", id] });
    await router.invalidate();
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
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
            <LifecycleBar position={p} onDone={invalidate} />
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
    </main>
  );
}

// ── Lifecycle action bar (approve / activate / publish / pause / close / archive)
function LifecycleBar({ position, onDone }: { position: Any; onDone: () => Promise<void> }) {
  const statusFn = useServerFn(setPositionStatus);
  const visibilityFn = useServerFn(setPositionVisibility);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<Any>, label: string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(`${label} · trace ${r.trace_id}`);
      await onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doStatus = (action: Any, label: string) =>
    run(() => statusFn({ data: { id: position.id, action } }), label);
  const doVis = (v: Any, label: string) =>
    run(() => visibilityFn({ data: { id: position.id, visibility: v } }), label);

  const s = position.status as string;
  const v = position.visibility as string;
  const isPublic = v === "public";

  type Action = { key: string; label: string; onClick: () => Promise<void>; variant?: Any };
  let primary: Action | null = null;
  const secondary: Action[] = [];

  if (s === "draft") {
    primary = { key: "submit", label: "Submit for review", onClick: () => doStatus("submit", "Submitted") };
  } else if (s === "submitted") {
    primary = { key: "start_review", label: "Start review", onClick: () => doStatus("start_review", "Under review") };
    secondary.push({ key: "approve", label: "Approve", onClick: () => doStatus("approve", "Approved") });
    secondary.push({ key: "clar", label: "Request clarification", onClick: () => doStatus("request_clarification", "Clarification requested") });
  } else if (s === "under_review") {
    primary = { key: "approve", label: "Approve", onClick: () => doStatus("approve", "Approved") };
    secondary.push({ key: "clar", label: "Request clarification", onClick: () => doStatus("request_clarification", "Clarification requested") });
  } else if (s === "needs_clarification") {
    primary = { key: "approve", label: "Approve", onClick: () => doStatus("approve", "Approved") };
    secondary.push({ key: "start_review", label: "Back to review", onClick: () => doStatus("start_review", "Under review") });
  } else if (s === "approved") {
    primary = { key: "activate", label: "Activate", onClick: () => doStatus("activate", "Activated") };
  } else if (s === "active") {
    primary = isPublic
      ? { key: "unpublish", label: "Unpublish", variant: "outline", onClick: () => doVis("private", "Removed from job board") }
      : { key: "publish", label: "Publish", onClick: () => doVis("public", "Live on job board") };
    secondary.push({ key: "pause", label: "Pause", onClick: () => doStatus("pause", "Paused") });
    secondary.push({ key: "mark_filled", label: "Mark filled", onClick: () => doStatus("mark_filled", "Marked filled") });
    secondary.push({ key: "close", label: "Close", onClick: () => doStatus("close", "Closed") });
  } else if (s === "paused") {
    primary = { key: "resume", label: "Resume", onClick: () => doStatus("activate", "Resumed") };
    secondary.push({ key: "close", label: "Close", onClick: () => doStatus("close", "Closed") });
  } else if (s === "filled") {
    primary = { key: "reopen", label: "Reopen", onClick: () => doStatus("reopen", "Reopened") };
    secondary.push({ key: "close", label: "Close", onClick: () => doStatus("close", "Closed") });
  } else if (s === "closed") {
    primary = { key: "reopen", label: "Reopen", onClick: () => doStatus("reopen", "Reopened") };
    secondary.push({ key: "archive", label: "Archive", onClick: () => doStatus("archive", "Archived") });
  }

  if (s !== "archived" && s !== "closed") {
    if (!secondary.some((b) => b.key === "archive")) {
      secondary.push({ key: "archive", label: "Archive", onClick: () => doStatus("archive", "Archived") });
    }
  }

  return (
    <div className="flex items-center gap-2">
      {primary && (
        <Button
          size="sm"
          variant={primary.variant}
          disabled={busy}
          onClick={primary.onClick}
          data-qa-action={`position-${primary.key}`}
        >
          {primary.label}
        </Button>
      )}
      {secondary.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy} aria-label="More actions" data-qa-action="position-actions-menu">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {secondary.map((b, i) => (
              <>
                {i > 0 && b.key === "archive" && <DropdownMenuSeparator key={`sep-${i}`} />}
                <DropdownMenuItem
                  key={b.key}
                  onClick={b.onClick}
                  data-qa-action={`position-${b.key}`}
                  className={b.key === "archive" ? "text-destructive" : undefined}
                >
                  {b.label}
                </DropdownMenuItem>
              </>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────────────────
function OverviewTab({
  position,
  matches,
  screening,
}: {
  position: Any;
  matches: Any[];
  screening: Any[];
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePosition);
  const [form, setForm] = useState({
    title: position.title ?? "",
    description: position.description ?? "",
    location: position.location ?? "",
    department: position.department ?? "",
    seniority: position.seniority ?? "",
    work_model: position.work_model ?? "",
    employment_type: position.employment_type ?? "",
  });
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    setForm({
      title: position.title ?? "",
      description: position.description ?? "",
      location: position.location ?? "",
      department: position.department ?? "",
      seniority: position.seniority ?? "",
      work_model: position.work_model ?? "",
      employment_type: position.employment_type ?? "",
    });
    setDirty(false);
  }, [position.id, position.updated_at]);

  const m = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: position.id,
          patch: {
            title: form.title,
            description: form.description,
            location: form.location || null,
            department: form.department || null,
            seniority: form.seniority || null,
            work_model: (form.work_model || null) as never,
            employment_type: (form.employment_type || null) as never,
          },
        },
      }),
    onSuccess: async (r) => {
      toast.success(`Saved · trace ${r.trace_id}`);
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["admin-position", position.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof typeof form>(k: K, val: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: val }));
    setDirty(true);
  };

  const stats = useMemo(() => {
    const scored = matches.filter((m) => m.score_runs?.score != null).length;
    const active = matches.filter(
      (m) => m.stage && !["archived", "not_moving_forward"].includes(m.stage),
    ).length;
    return {
      total: matches.length,
      scored,
      active,
      screening: screening.length,
    };
  }, [matches, screening]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4 rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Requisition
          </h2>
          <Button
            size="sm"
            disabled={!dirty || m.isPending}
            onClick={() => m.mutate()}
            data-qa-action="save-overview"
          >
            {m.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            rows={8}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="dept">Department</Label>
            <Input id="dept" value={form.department} onChange={(e) => set("department", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="loc">Location</Label>
            <Input id="loc" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sen">Seniority</Label>
            <Input id="sen" value={form.seniority} onChange={(e) => set("seniority", e.target.value)} />
          </div>
          <div>
            <Label>Work model</Label>
            <Select
              value={form.work_model || "unset"}
              onValueChange={(v) => set("work_model", v === "unset" ? "" : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">—</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="onsite">Onsite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Employment type</Label>
            <Select
              value={form.employment_type || "unset"}
              onValueChange={(v) => set("employment_type", v === "unset" ? "" : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">—</SelectItem>
                <SelectItem value="full_time">Full time</SelectItem>
                <SelectItem value="part_time">Part time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="temporary">Temporary</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {dirty && (
          <p className="text-xs text-warning-foreground dark:text-warning-foreground">Unsaved changes.</p>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pipeline
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Total" value={stats.total} />
            <Stat label="Active" value={stats.active} />
            <Stat label="Scored" value={stats.scored} />
            <Stat label="Screening qs" value={stats.screening} />
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timestamps
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Submitted</dt>
            <dd>{fmt(position.submitted_at)}</dd>
            <dt className="text-muted-foreground">Approved</dt>
            <dd>{fmt(position.approved_at)}</dd>
            <dt className="text-muted-foreground">Published</dt>
            <dd>{fmt(position.published_at)}</dd>
            <dt className="text-muted-foreground">Closed</dt>
            <dd>{fmt(position.closed_at)}</dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{fmt(position.updated_at)}</dd>
          </dl>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Job board
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            Only <code>active + public</code> positions appear on the board.
          </p>
          <Link
            to="/jobs/$id/apply"
            params={{ id: position.id }}
            target="_blank"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Open application form <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background/50 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function fmt(v?: string | null) {
  if (!v) return <span className="text-muted-foreground">—</span>;
  return new Date(v).toLocaleString();
}

// ── Requirements / Preferred / Dealbreakers editor (shared) ─────────────────
