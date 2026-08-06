// Default tab of the position workspace: requisition editor + pipeline stats.
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink } from "lucide-react";
import { updatePosition } from "@/lib/admin.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// ── Overview ───────────────────────────────────────────────────────────────
export function OverviewTab({
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
