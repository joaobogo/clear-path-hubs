/**
 * RoleMemoryPanel — shared recruiter memory & handoff surface.
 *
 * Structured, position-scoped notes with a fixed rationale taxonomy:
 * brief, rationale, handoff, candidate_reasoning, decision, risk, next_step.
 * Persisted server-side, visible to every org member + staff, so the role
 * never resets when a recruiter changes.
 */
import { useMemo, useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listRoleMemory,
  createRoleMemory,
  updateRoleMemory,
  deleteRoleMemory,
  ROLE_MEMORY_KINDS,
  type RoleMemoryDTO,
  type RoleMemoryKind,
} from "@/lib/role-memory.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pin, PinOff, Trash2, NotebookPen, ArrowRightLeft } from "lucide-react";
import { useConfirmAction } from "@/components/ds";

const KIND_LABEL: Record<RoleMemoryKind, string> = {
  brief: "Brief anchor",
  rationale: "Rationale",
  handoff: "Handoff note",
  candidate_reasoning: "Candidate reasoning",
  decision: "Decision",
  risk: "Risk / watch-out",
  next_step: "Next step",
};

const KIND_HINT: Record<RoleMemoryKind, string> = {
  brief: "What this role really is, in plain language. The anchor everyone comes back to.",
  rationale: "Why we chose this direction — the reasoning behind the brief, requirements, or scoring.",
  handoff: "Everything the next recruiter needs to run this role without a call.",
  candidate_reasoning: "Why a specific candidate is a fit, borderline, or a pass — with evidence.",
  decision: "A decision that was made, when, and by whom.",
  risk: "A risk, contradiction, or thing to watch as the role progresses.",
  next_step: "The next concrete action and who owns it.",
};

const KIND_ORDER: RoleMemoryKind[] = [
  "brief",
  "handoff",
  "rationale",
  "decision",
  "candidate_reasoning",
  "risk",
  "next_step",
];

const queryKey = (positionId: string) => ["role-memory", positionId] as const;

export function RoleMemoryPanel({
  positionId,
  canEdit,
}: {
  positionId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRoleMemory);
  const createFn = useServerFn(createRoleMemory);
  const updateFn = useServerFn(updateRoleMemory);
  const deleteFn = useServerFn(deleteRoleMemory);

  const { data: rows } = useSuspenseQuery({
    queryKey: queryKey(positionId),
    queryFn: () => listFn({ data: { position_id: positionId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKey(positionId) });

  const create = useMutation({
    mutationFn: (input: {
      kind: RoleMemoryKind;
      title: string;
      body: string;
      pinned: boolean;
    }) => createFn({ data: { position_id: positionId, ...input } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Memory saved. Handoff-safe.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; patch: Partial<RoleMemoryDTO> }) =>
      updateFn({
        data: {
          id: input.id,
          title: input.patch.title,
          body: input.patch.body,
          kind: input.patch.kind,
          pinned: input.patch.pinned,
        },
      }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Memory removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const g = new Map<RoleMemoryKind, RoleMemoryDTO[]>();
    for (const k of KIND_ORDER) g.set(k, []);
    for (const r of rows) g.get(r.kind)?.push(r);
    return g;
  }, [rows]);

  const pinned = rows.filter((r) => r.pinned);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Recruiter memory &amp; handoff</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Shared, structured notes about this role. If the recruiter changes,
              the role does not reset — brief, rationale, decisions, and candidate
              reasoning stay with the position, not with any one inbox.
            </p>
          </div>
        </div>
      </header>

      {canEdit && <CreateForm onCreate={(input) => create.mutate(input)} busy={create.isPending} />}

      {pinned.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Pin className="h-3.5 w-3.5" /> Pinned
          </div>
          <div className="grid gap-3">
            {pinned.map((r) => (
              <MemoryCard
                key={r.id}
                row={r}
                canEdit={canEdit}
                onTogglePin={() => update.mutate({ id: r.id, patch: { pinned: !r.pinned } })}
                onDelete={() => remove.mutate(r.id)}
                onSave={(patch) => update.mutate({ id: r.id, patch })}
              />
            ))}
          </div>
        </section>
      )}

      {KIND_ORDER.map((kind) => {
        const list = (grouped.get(kind) ?? []).filter((r) => !r.pinned);
        if (list.length === 0) return null;
        return (
          <section key={kind} className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold">{KIND_LABEL[kind]}</h3>
              <p className="text-xs text-muted-foreground">{KIND_HINT[kind]}</p>
            </div>
            <div className="grid gap-3">
              {list.map((r) => (
                <MemoryCard
                  key={r.id}
                  row={r}
                  canEdit={canEdit}
                  onTogglePin={() => update.mutate({ id: r.id, patch: { pinned: !r.pinned } })}
                  onDelete={() => remove.mutate(r.id)}
                  onSave={(patch) => update.mutate({ id: r.id, patch })}
                />
              ))}
            </div>
          </section>
        );
      })}

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <NotebookPen className="mx-auto mb-3 h-6 w-6" />
          No memory yet. Start with a brief anchor and a handoff note so the next
          person on this role can run it without a call.
        </div>
      )}
    </div>
  );
}

function CreateForm({
  onCreate,
  busy,
}: {
  onCreate: (input: { kind: RoleMemoryKind; title: string; body: string; pinned: boolean }) => void;
  busy: boolean;
}) {
  const [kind, setKind] = useState<RoleMemoryKind>("handoff");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const submit = () => {
    if (title.trim().length < 2 || body.trim().length < 2) {
      toast.error("Title and body are required");
      return;
    }
    onCreate({ kind, title: title.trim(), body: body.trim(), pinned });
    setTitle("");
    setBody("");
    setPinned(false);
  };

  return (
    <div className="grid gap-3 rounded-xl border p-4">
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as RoleMemoryKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_MEMORY_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{KIND_HINT[kind]}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="rm-title">
            Title
          </Label>
          <Input
            id="rm-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Why we relaxed the 5 yrs bar to 3"
            maxLength={200}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="rm-body">
          Detail
        </Label>
        <Textarea
          id="rm-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Context, reasoning, decision, links to candidate IDs. Written for the next recruiter."
          rows={5}
          maxLength={6000}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
            className="h-4 w-4"
          />
          Pin to top (visible in every handoff)
        </label>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save memory"}
        </Button>
      </div>
    </div>
  );
}

function MemoryCard({
  row,
  canEdit,
  onTogglePin,
  onDelete,
  onSave,
}: {
  row: RoleMemoryDTO;
  canEdit: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
  onSave: (patch: Partial<RoleMemoryDTO>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(row.title);
  const [body, setBody] = useState(row.body);

  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-[11px]">
          {KIND_LABEL[row.kind]}
        </Badge>
        {row.pinned && (
          <Badge className="text-[11px]">
            <Pin className="mr-1 h-3 w-3" /> Pinned
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {row.author_display_name ?? "Team member"} ·{" "}
          {new Date(row.updated_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={6000}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave({ title: title.trim(), body: body.trim() });
                setEditing(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h4 className="mt-2 text-sm font-semibold">{row.title}</h4>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p>
        </>
      )}

      {canEdit && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onTogglePin}>
            {row.pinned ? (
              <>
                <PinOff className="mr-1 h-3.5 w-3.5" /> Unpin
              </>
            ) : (
              <>
                <Pin className="mr-1 h-3.5 w-3.5" /> Pin
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              const r = await confirm({
                title: "Delete memory entry",
                object: row.title ?? undefined,
                description: "This note is removed from the role's memory.",
                impact: ["Future summaries stop using this note"],
                confirmLabel: "Delete entry",
                tone: "destructive",
              });
              if (r.confirmed) onDelete();
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      )}
      {confirmDialog}
    </article>
  );
}
