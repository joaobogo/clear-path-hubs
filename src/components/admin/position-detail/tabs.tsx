/**
 * Secondary tabs of the admin position workspace.
 *
 * Requirement editing, the blueprint, pipeline, activity, audit and settings are
 * all off-screen at first paint. Keeping them here means opening a role loads the
 * overview immediately and pulls each panel in only when it is opened.
 */
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

import { Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { PanelState } from "@/components/admin/panel-state";

import { RecordActivityTab } from "@/components/admin/record-activity-tab";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
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
  Copy,
} from "lucide-react";
import { JobQualityPanel } from "@/components/positions/JobQualityPanel";
import { GeneratedBlueprintPanel } from "@/components/positions/generated-blueprint-panel";
import { RoleMemoryPanel } from "@/components/role-memory-panel";
import { SourcingOpsPanel } from "@/components/positions/sourcing-ops-panel";
import { useConfirmAction } from "@/components/ds";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/** Canonical pipeline stage order, mirrored from the position workspace. */
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

export function RequirementsEditor({
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
    onError: (e: Error) => toastError(e),
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

export function ScreeningEditor({ positionId, questions }: { positionId: string; questions: Any[] }) {
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
    onError: (e: Error) => toastError(e),
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
export function BlueprintTab({ position, screening }: { position: Any; screening: Any[] }) {
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
export function PipelineTab({ matches, positionId }: { matches: Any[]; positionId: string }) {
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
                  {m.updated_at ? new Date(m.updated_at).toLocaleDateString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: WORKSPACE_TIMEZONE }) : "—"}
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

      <StageAgingPanel positionId={positionId} />

      <PositionSourceQualityPanel positionId={positionId} />

      <InterviewExceptionsPanel positionId={positionId} />

      <PositionOfferTrackingPanel positionId={positionId} />

      <RejectionReasonsPanel positionId={positionId} />

    </div>
  );
}

// ── Activity ────────────────────────────────────────────────────────────────
export function ActivityTab({ id }: { id: string }) {
  // Paginated, actor-named, reason-carrying trail shared with the candidate and
  // client detail pages.
  return <RecordActivityTab entity="position" id={id} title="Activity" />;
}

// ── Settings ────────────────────────────────────────────────────────────────
export function SettingsTab({ position, onDone }: { position: Any; onDone: () => Promise<void> }) {
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

export function AuditTab({ id }: { id: string }) {
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["admin-position-audit", id],
    queryFn: () => getPositionActivity({ data: { id, limit: 200 } }),
    placeholderData: (prev) => prev,
  });

  const rows = (data ?? []) as Any[];

  return (
    <PanelState
      query={{ isPending, isLoading: isPending, isError, error, isFetching, refetch }}
      skeletonRows={8}
      showLoadingOverlay
      isEmpty={rows.length === 0}
      empty={
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-muted-foreground">
          No audit events yet.
        </div>
      }
    >
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
                    {new Date(r.created_at).toLocaleString(APP_LOCALE, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                      timeZone: WORKSPACE_TIMEZONE,
                    })}
                  </div>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>
                    Actor{" "}
                    <span className="font-mono">
                      {r.actor_user_id ? String(r.actor_user_id).slice(0, 8) : "system"}
                    </span>
                  </span>
                  {r.trace_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-1 py-0 text-xs text-muted-foreground"
                      onClick={() => {
                        void navigator.clipboard.writeText(r.trace_id);
                      }}
                    >
                      <Copy className="mr-1 h-3 w-3" />
                      Copy reference
                    </Button>
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
        </ul>
      </div>
    </PanelState>
  );
}


