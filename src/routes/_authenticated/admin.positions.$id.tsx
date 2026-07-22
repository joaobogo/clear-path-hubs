import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  getPosition,
  updatePosition,
  setPositionStatus,
  setPositionVisibility,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/positions/$id")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-position", params.id],
      queryFn: () => getPosition({ data: { id: params.id } }),
    });
    if (!d) throw notFound();
    return d;
  },
  notFoundComponent: () => <div className="p-8">Position not found.</div>,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  head: () => ({ meta: [{ title: "Position workspace · TaaSFlow admin" }] }),
  component: PositionWorkspace,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function PositionWorkspace() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({
    queryKey: ["admin-position", id],
    queryFn: () => getPosition({ data: { id } }),
  });
  const p = data!.position as AnyRow;

  const updateFn = useServerFn(updatePosition);
  const statusFn = useServerFn(setPositionStatus);
  const visibilityFn = useServerFn(setPositionVisibility);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({
    title: p.title ?? "",
    description: p.description ?? "",
    location: p.location ?? "",
    work_model: p.work_model ?? "",
    employment_type: p.employment_type ?? "",
    seniority: p.seniority ?? "",
    requirements: JSON.stringify(p.requirements ?? [], null, 2),
    preferred_requirements: JSON.stringify(p.preferred_requirements ?? [], null, 2),
  });

  useEffect(() => setDirty(false), [id]);

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-position", id] });
    await router.invalidate();
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      let requirements: unknown[];
      let preferred: unknown[];
      try {
        requirements = JSON.parse(form.requirements);
        preferred = JSON.parse(form.preferred_requirements);
      } catch {
        throw new Error("Requirements must be valid JSON arrays");
      }
      return updateFn({
        data: {
          id,
          patch: {
            title: form.title,
            description: form.description,
            location: form.location || null,
            work_model: (form.work_model || null) as never,
            employment_type: (form.employment_type || null) as never,
            seniority: form.seniority || null,
            requirements,
            preferred_requirements: preferred,
          },
        },
      });
    },
    onSuccess: async (r) => {
      setFeedback(`Saved · trace ${r.trace_id}`);
      setError(null);
      setDirty(false);
      await invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (action: string) =>
      statusFn({ data: { id, action: action as never } }),
    onSuccess: async (r) => {
      setFeedback(`Status → ${r.position?.status} · trace ${r.trace_id}`);
      setError(null);
      await invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const visMut = useMutation({
    mutationFn: (visibility: string) =>
      visibilityFn({ data: { id, visibility: visibility as never } }),
    onSuccess: async (r) => {
      setFeedback(`Visibility → ${r.position?.visibility} · trace ${r.trace_id}`);
      setError(null);
      await invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const busy = saveMut.isPending || statusMut.isPending || visMut.isPending;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <Link
          to="/admin/clients/$id"
          params={{ id: p.organizations?.id ?? p.organization_id }}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {p.organizations?.name ?? "Client"}
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold">{p.title}</h1>
          <Badge>{p.status}</Badge>
          <Badge variant="outline">{p.visibility}</Badge>
        </div>
      </div>

      {feedback && (
        <Alert>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Requisition</h2>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => {
                setForm({ ...form, title: e.target.value });
                setDirty(true);
              }}
            />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={6}
              value={form.description}
              onChange={(e) => {
                setForm({ ...form, description: e.target.value });
                setDirty(true);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="loc">Location</Label>
              <Input
                id="loc"
                value={form.location}
                onChange={(e) => {
                  setForm({ ...form, location: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <Label htmlFor="sen">Seniority</Label>
              <Input
                id="sen"
                value={form.seniority}
                onChange={(e) => {
                  setForm({ ...form, seniority: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <Label>Work model</Label>
              <Select
                value={form.work_model || "unset"}
                onValueChange={(v) => {
                  setForm({ ...form, work_model: v === "unset" ? "" : v });
                  setDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                onValueChange={(v) => {
                  setForm({ ...form, employment_type: v === "unset" ? "" : v });
                  setDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
          <div>
            <Label htmlFor="req">Requirements (JSON array)</Label>
            <Textarea
              id="req"
              rows={5}
              className="font-mono text-xs"
              value={form.requirements}
              onChange={(e) => {
                setForm({ ...form, requirements: e.target.value });
                setDirty(true);
              }}
            />
          </div>
          <div>
            <Label htmlFor="pref">Preferred (JSON array)</Label>
            <Textarea
              id="pref"
              rows={4}
              className="font-mono text-xs"
              value={form.preferred_requirements}
              onChange={(e) => {
                setForm({ ...form, preferred_requirements: e.target.value });
                setDirty(true);
              }}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button disabled={busy || !dirty} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? "Saving…" : "Save requisition"}
            </Button>
            {dirty && (
              <span className="self-center text-xs text-amber-700 dark:text-amber-300">
                Unsaved changes
              </span>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border p-4 space-y-2">
            <h2 className="font-semibold">Lifecycle</h2>
            <p className="text-xs text-muted-foreground">
              Precondition: current status = <code>{p.status}</code>.
            </p>
            {p.status === "submitted" && (
              <>
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => statusMut.mutate("request_clarification")}
                >
                  Request clarification
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => statusMut.mutate("approve")}
                >
                  Approve
                </Button>
              </>
            )}
            {p.status === "needs_clarification" && (
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => statusMut.mutate("approve")}
              >
                Approve
              </Button>
            )}
            {p.status === "approved" && (
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => statusMut.mutate("activate")}
              >
                Activate
              </Button>
            )}
            {p.status === "active" && (
              <>
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => statusMut.mutate("pause")}
                >
                  Pause
                </Button>
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => statusMut.mutate("close")}
                >
                  Close
                </Button>
              </>
            )}
            {p.status === "paused" && (
              <>
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => statusMut.mutate("activate")}
                >
                  Resume
                </Button>
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => statusMut.mutate("close")}
                >
                  Close
                </Button>
              </>
            )}
            {p.status === "closed" && (
              <Button
                className="w-full"
                variant="secondary"
                disabled={busy}
                onClick={() => statusMut.mutate("reopen")}
              >
                Reopen
              </Button>
            )}
          </section>

          <section className="rounded-lg border p-4 space-y-2">
            <h2 className="font-semibold">Visibility</h2>
            <p className="text-xs text-muted-foreground">
              Only <code>active + public</code> positions appear on the job board.
            </p>
            <Select
              value={p.visibility}
              onValueChange={(v) => visMut.mutate(v)}
              disabled={busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public — on job board</SelectItem>
                <SelectItem value="private">Private — invite only</SelectItem>
                <SelectItem value="internal">Internal — staff only</SelectItem>
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">Screening ({data!.screening.length})</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data!.screening.map((q: AnyRow) => (
                <li key={q.id} className="border-b pb-1">
                  {q.dealbreaker && <span className="text-destructive">* </span>}
                  {q.question}
                </li>
              ))}
              {data!.screening.length === 0 && (
                <li className="text-muted-foreground">No screening questions.</li>
              )}
            </ul>
          </section>

          <section className="rounded-lg border p-4">
            <h2 className="font-semibold">Candidates ({data!.matches.length})</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data!.matches.slice(0, 10).map((m: AnyRow) => (
                <li key={m.id} className="flex justify-between gap-2 border-b pb-1">
                  <Link
                    to="/admin/candidates/$id"
                    params={{ id: m.id }}
                    className="truncate text-primary hover:underline"
                  >
                    {m.candidate_profiles?.full_name ?? "—"}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    {m.score_runs?.score?.toFixed(0) ?? "—"} · {m.stage}
                  </span>
                </li>
              ))}
              {data!.matches.length === 0 && (
                <li className="text-muted-foreground">No candidates yet.</li>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
