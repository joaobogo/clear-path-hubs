import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { JobQualityPanel } from "@/components/positions/JobQualityPanel";
import { RoleMemoryPanel } from "@/components/role-memory-panel";
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
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {p.location && <span>{p.location}</span>}
              {p.work_model && <span>· {p.work_model}</span>}
              {p.employment_type && <span>· {p.employment_type.replace(/_/g, " ")}</span>}
              {p.seniority && <span>· {p.seniority}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                to="/admin/positions/$id/edit"
                params={{ id: p.id }}
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
        {tab === "overview" && <OverviewTab position={p} matches={matches} screening={screening} />}
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
        {tab === "pipeline" && <PipelineTab matches={matches} />}
        {tab === "memory" && <RoleMemoryPanel positionId={id} canEdit={true} />}
        {tab === "activity" && <ActivityTab id={id} />}
        {tab === "audit" && <AuditTab id={id} />}
        {tab === "settings" && <SettingsTab position={p} onDone={invalidate} />}
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
function RequirementsEditor({
  positionId,
  field,
  title,
  hint,
  value,
}: {
  positionId: string;
  field: "requirements" | "preferred_requirements" | "dealbreakers";
  title: string;
  hint: string;
  value: unknown;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePosition);
  const initial = useMemo(() => toStringList(value).join("\n"), [value]);
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);

  const dirty = text !== initial;
  const items = useMemo(
    () => text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    [text],
  );

  const m = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id: positionId,
          patch: { [field]: fromStringList(text) } as Any,
        },
      }),
    onSuccess: async (r) => {
      toast.success(`${title} saved · trace ${r.trace_id}`);
      await qc.invalidateQueries({ queryKey: ["admin-position", positionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <Button
            size="sm"
            disabled={!dirty || m.isPending}
            onClick={() => m.mutate()}
            data-qa-action={`save-${field}`}
          >
            {m.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        <Textarea
          className="mt-3 font-mono text-sm"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Postgres experience\nWritten and spoken English (B2+)\n…"}
        />
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">
          {items.length} item{items.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Preview
        </h3>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Add one item per line. Preview updates as you type.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {items.map((it, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Screening editor ───────────────────────────────────────────────────────
type LocalQ = {
  id?: string;
  question: string;
  answer_type: Any;
  required: boolean;
  dealbreaker: boolean;
  scoring_weight: number;
  display_order: number;
};

function ScreeningEditor({ positionId, questions }: { positionId: string; questions: Any[] }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveScreeningQuestions);

  const initial = useMemo<LocalQ[]>(
    () =>
      questions.map((q, i) => ({
        id: q.id,
        question: q.question ?? "",
        answer_type: q.answer_type ?? "text",
        required: Boolean(q.required),
        dealbreaker: Boolean(q.dealbreaker),
        scoring_weight: Number(q.scoring_weight ?? 1),
        display_order: i,
      })),
    [questions],
  );
  const [items, setItems] = useState<LocalQ[]>(initial);
  useEffect(() => setItems(initial), [initial]);

  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  const m = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          position_id: positionId,
          questions: items.map((q, i) => ({ ...q, display_order: i })),
        },
      }),
    onSuccess: async (r) => {
      toast.success(`Saved ${r.count} question${r.count === 1 ? "" : "s"} · trace ${r.trace_id}`);
      await qc.invalidateQueries({ queryKey: ["admin-position", positionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const add = () =>
    setItems((xs) => [
      ...xs,
      {
        question: "",
        answer_type: "text",
        required: false,
        dealbreaker: false,
        scoring_weight: 1,
        display_order: xs.length,
      },
    ]);
  const remove = (i: number) => setItems((xs) => xs.filter((_, idx) => idx !== i));
  const patch = (i: number, next: Partial<LocalQ>) =>
    setItems((xs) => xs.map((q, idx) => (idx === i ? { ...q, ...next } : q)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Screening questions</h2>
          <p className="text-xs text-muted-foreground">
            Applicants answer these on the job board. Dealbreaker questions can auto-disqualify.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={add} data-qa-action="add-screening">
            <Plus className="h-3.5 w-3.5" /> Add question
          </Button>
          <Button
            size="sm"
            disabled={!dirty || m.isPending}
            onClick={() => m.mutate()}
            data-qa-action="save-screening"
          >
            {m.isPending ? "Saving…" : `Save ${items.length}`}
          </Button>
        </div>
      </div>

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No screening questions yet. Add one to gate applications.
        </div>
      )}

      <ol className="space-y-3">
        {items.map((q, i) => (
          <li key={q.id ?? `new-${i}`} className="rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="mt-2 text-xs text-muted-foreground tabular-nums">Q{i + 1}</div>
              <div className="flex-1 space-y-3">
                <Textarea
                  rows={2}
                  value={q.question}
                  onChange={(e) => patch(i, { question: e.target.value })}
                  placeholder="Ask the candidate a specific, evidence-based question…"
                />
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <Select
                    value={q.answer_type}
                    onValueChange={(v) => patch(i, { answer_type: v })}
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Short text</SelectItem>
                      <SelectItem value="long_text">Long text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Yes / No</SelectItem>
                      <SelectItem value="single_choice">Single choice</SelectItem>
                      <SelectItem value="multi_choice">Multi choice</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="file">File upload</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={q.required}
                      onCheckedChange={(v) => patch(i, { required: Boolean(v) })}
                    />
                    <span>Required</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <Checkbox
                      checked={q.dealbreaker}
                      onCheckedChange={(v) => patch(i, { dealbreaker: Boolean(v) })}
                    />
                    <span className="text-destructive">Dealbreaker</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <span className="text-muted-foreground">Weight</span>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      className="h-8 w-20"
                      value={q.scoring_weight}
                      onChange={(e) =>
                        patch(i, { scoring_weight: Number(e.target.value) || 0 })
                      }
                    />
                  </label>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                aria-label={`Remove question ${i + 1}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Scoring blueprint (read-only derived view) ─────────────────────────────
function BlueprintTab({ position, screening }: { position: Any; screening: Any[] }) {
  const reqs = toStringList(position.requirements);
  const prefs = toStringList(position.preferred_requirements);
  const deals = toStringList(position.dealbreakers);
  const reqWeight = reqs.length * 2;
  const prefWeight = prefs.length * 1;
  const scrWeight = screening.reduce(
    (n, q) => n + (Number(q.scoring_weight) || 1),
    0,
  );
  const total = reqWeight + prefWeight + scrWeight;
  const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const ready = reqs.length > 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Scoring blueprint</h2>
        <p className="text-xs text-muted-foreground">
          Derived from requirements, preferred criteria, dealbreakers, and screening
          questions. Runs the same way for every candidate on this position.
        </p>
        <div className="mt-4 space-y-3">
          <BlueprintRow label="Must-have requirements" count={reqs.length} weight={reqWeight} share={share(reqWeight)} />
          <BlueprintRow label="Preferred criteria" count={prefs.length} weight={prefWeight} share={share(prefWeight)} />
          <BlueprintRow label="Screening questions" count={screening.length} weight={scrWeight} share={share(scrWeight)} />
          <BlueprintRow label="Dealbreakers (auto-fail)" count={deals.length} weight={0} share={0} />
        </div>
        {!ready && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground dark:text-warning-foreground">
            Scoring is blocked until at least one must-have requirement is set.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-card p-5 text-sm">
        <h2 className="text-sm font-semibold">Engine</h2>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Blueprint version</dt>
          <dd className="font-mono">taasflow-blueprint-v1.0.0</dd>
          <dt className="text-muted-foreground">Scoring mode</dt>
          <dd>Evidence-first, deterministic</dd>
          <dt className="text-muted-foreground">Immutability</dt>
          <dd>Enforced by DB trigger</dd>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Every candidate score references this blueprint version so results stay
          reproducible even after criteria change.
        </p>
      </div>
    </div>
  );
}

function BlueprintRow({
  label,
  count,
  weight,
  share,
}: {
  label: string;
  count: number;
  weight: number;
  share: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {count} · weight {weight} · {share}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className="h-1.5 rounded-full bg-primary"
          style={{ width: `${share}%` }}
        />
      </div>
    </div>
  );
}

// ── Pipeline ────────────────────────────────────────────────────────────────
function PipelineTab({ matches }: { matches: Any[] }) {
  const byStage = useMemo(() => {
    const buckets: Record<string, Any[]> = {};
    for (const s of STAGE_ORDER) buckets[s] = [];
    for (const m of matches) {
      const key = (m.stage ?? "new") as string;
      (buckets[key] ??= []).push(m);
    }
    return buckets;
  }, [matches]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STAGE_ORDER.filter((s) => byStage[s]?.length).map((s) => (
          <div key={s} className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {s.replace(/_/g, " ")}
              </span>
              <span className="tabular-nums text-xs text-muted-foreground">
                {byStage[s].length}
              </span>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {byStage[s].slice(0, 6).map((m) => (
                <li key={m.id}>
                  <Link
                    to="/admin/candidates/$id"
                    params={{ id: m.id }}
                    className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50"
                  >
                    <span className="truncate">
                      {m.candidate_profiles?.full_name ?? "Unknown"}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {m.score_runs?.score != null
                        ? Math.round(m.score_runs.score)
                        : "—"}
                    </span>
                  </Link>
                </li>
              ))}
              {byStage[s].length > 6 && (
                <li className="text-xs text-muted-foreground">
                  +{byStage[s].length - 6} more
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <header className="border-b px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          All candidates ({matches.length})
        </header>
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Processing</th>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium tabular-nums">Score</th>
              <th className="px-3 py-2 font-medium">Updated</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {matches.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <div className="font-medium">{m.candidate_profiles?.full_name ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {m.candidate_profiles?.email ?? ""}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">{(m.stage ?? "—").replace(/_/g, " ")}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {(m.processing_state ?? "—").replace(/_/g, " ")}
                </td>
                <td className="px-3 py-2 text-xs">
                  {(m.client_visibility ?? "—").replace(/_/g, " ")}
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {m.score_runs?.score != null ? Math.round(m.score_runs.score) : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {m.updated_at ? new Date(m.updated_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/admin/candidates/$id"
                    params={{ id: m.id }}
                    className="text-primary hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No candidates on this position yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────
function ActivityTab({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-position-activity", id],
    queryFn: () => getPositionActivity({ data: { id, limit: 100 } }),
  });
  const rows = (data ?? []) as Any[];
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">When</th>
            <th className="px-3 py-2 font-medium">Action</th>
            <th className="px-3 py-2 font-medium">Actor</th>
            <th className="px-3 py-2 font-medium">Trace</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                {r.actor_user_id ? String(r.actor_user_id).slice(0, 8) : "system"}
              </td>
              <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                {r.trace_id ?? "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                No activity yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
function SettingsTab({ position, onDone }: { position: Any; onDone: () => Promise<void> }) {
  const visibilityFn = useServerFn(setPositionVisibility);
  const statusFn = useServerFn(setPositionStatus);
  const deleteFn = useServerFn(deletePosition);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { confirm, confirmDialog } = useConfirmAction();

  const setVis = async (v: Any) => {
    try {
      const r = await visibilityFn({ data: { id: position.id, visibility: v } });
      toast.success(`Visibility → ${v} · trace ${r.trace_id}`);
      await onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const archive = async () => {
    const result = await confirm({
      title: "Archive position",
      object: position.title,
      description: "The position is hidden from every workspace and the public job board.",
      impact: [
        "Candidates already on the position are kept",
        "Open applications stop receiving new submissions",
        "You can restore the position later",
      ],
      confirmLabel: "Archive position",
    });
    if (!result.confirmed) return;
    setBusy(true);
    try {
      const r = await statusFn({ data: { id: position.id, action: "archive" } });
      toast.success(`Archived · trace ${r.trace_id}`);
      await onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hardDelete = async () => {
    const result = await confirm({
      title: "Permanently delete position",
      object: position.title,
      description:
        "This erases the position and everything attached to it. It cannot be undone — archive instead if you only want it hidden.",
      impact: [
        "Every linked candidate match, application and CV file is purged",
        "Scoring runs, evidence records and interviews are destroyed",
        "Tasks, notifications and memory entries are removed",
      ],
      typedConfirmation: "DELETE",
      reason: { label: "Reason for deletion", required: true, placeholder: "e.g. duplicate requisition created in error" },
      confirmLabel: "Permanently delete",
      tone: "destructive",
    });
    if (!result.confirmed) return;
    setBusy(true);
    try {
      const r = await deleteFn({
        data: { id: position.id, reason: result.reason || "admin_hard_delete" },
      });
      toast.success(`Position deleted · trace ${r.trace_id}`);
      router.navigate({ to: "/admin/positions" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-5 text-sm">
        <h2 className="font-semibold">Visibility</h2>
        <p className="text-xs text-muted-foreground">
          Only <code>active + public</code> positions appear on the job board.
        </p>
        <div className="mt-3">
          <Select value={position.visibility} onValueChange={setVis}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public — on job board</SelectItem>
              <SelectItem value="private">Private — invite only</SelectItem>
              <SelectItem value="internal">Internal — staff only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5 text-sm">
        <h2 className="font-semibold">Identifiers</h2>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
          <dt className="text-muted-foreground">Position ID</dt>
          <dd className="break-all font-mono">{position.id}</dd>
          <dt className="text-muted-foreground">Org ID</dt>
          <dd className="break-all font-mono">{position.organization_id}</dd>
        </dl>
      </div>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm lg:col-span-2">
        <h2 className="font-semibold text-destructive">Danger zone</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Archive</strong> hides the position from every workspace and removes it from the
          job board and pipelines. Candidates on the position are retained.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Delete permanently</strong> purges the position and every linked candidate,
          application, CV, scoring run, evidence record, interview, task, and memory entry from the
          database. This cannot be undone.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={position.status === "archived" || busy}
            title={
              position.status === "archived"
                ? "This position is already archived"
                : undefined
            }
            onClick={archive}
            data-qa-action="archive-position"
          >
            {position.status === "archived" ? "Already archived" : "Archive position"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="min-h-11"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={hardDelete}
            data-qa-action="delete-position"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

// ── Audit ───────────────────────────────────────────────────────────────────
function humanizeDiff(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, Any>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, Any>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const notes: string[] = [];
  for (const k of keys) {
    if (["id", "created_at", "updated_at"].includes(k)) continue;
    const bv = b[k];
    const av = a[k];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    const fmt = (v: Any) => {
      if (v == null) return "—";
      if (typeof v === "string") return v.length > 60 ? v.slice(0, 57) + "…" : v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
      return "updated";
    };
    notes.push(`${k.replace(/_/g, " ")}: ${fmt(bv)} → ${fmt(av)}`);
  }
  return notes;
}

function AuditTab({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ["admin-position-audit", id],
    queryFn: () => getPositionActivity({ data: { id, limit: 200 } }),
  });
  const rows = (data ?? []) as Any[];
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        Immutable audit trail — every change to this position, oldest first at the bottom.
      </div>
      <ul className="divide-y">
        {rows.map((r) => {
          const notes = humanizeDiff(r.before_state, r.after_state);
          return (
            <li key={r.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">{r.action.replace(/_/g, " ")}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Actor{" "}
                <span className="font-mono">
                  {r.actor_user_id ? String(r.actor_user_id).slice(0, 8) : "system"}
                </span>
                {r.trace_id && (
                  <>
                    {" · trace "}
                    <span className="font-mono">{r.trace_id}</span>
                  </>
                )}
              </div>
              {notes.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {notes.slice(0, 8).map((n, i) => (
                    <li key={i}>• {n}</li>
                  ))}
                  {notes.length > 8 && (
                    <li className="italic">…and {notes.length - 8} more field changes</li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="px-4 py-10 text-center text-muted-foreground">
            No audit events yet.
          </li>
        )}
      </ul>
    </div>
  );
}
