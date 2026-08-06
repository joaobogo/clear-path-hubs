import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Lock } from "lucide-react";
import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPositionCriteria,
  publishCriteriaVersion,
  saveCriteriaDraft,
} from "@/lib/scoring/criteria-authoring.functions";
import {
  normaliseWeights,
  validateForPublish,
  type CriterionDraft,
  type RubricVersionSummary,
} from "@/lib/scoring/criteria-authoring.server";

export const Route = createFileRoute("/_authenticated/admin/positions/$id_/criteria")({
  head: () => ({
    meta: [
      { title: "Scoring criteria · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Author the criteria a role is scored on, publish an immutable version, and see which version scored each candidate.",
      },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.positions.$id_.criteria.tsx",
  ),
  component: CriteriaPage,
});

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

const BLANK: CriterionDraft = {
  key: "",
  label: "",
  evidence: "",
  weight: 25,
  must_have: false,
};

function CriteriaPage() {
  const { id } = useParams({ from: "/_authenticated/admin/positions/$id_/criteria" });
  const queryClient = useQueryClient();
  const fetchCriteria = useServerFn(getPositionCriteria);
  const saveDraft = useServerFn(saveCriteriaDraft);
  const publish = useServerFn(publishCriteriaVersion);

  const queryKey = ["admin", "position-criteria", id] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => fetchCriteria({ data: { position_id: id } }),
  });

  const versions = (query.data?.versions ?? []) as RubricVersionSummary[];
  const published = useMemo(
    () => versions.find((v) => v.status === "active" || v.status === "approved") ?? null,
    [versions],
  );
  const draft = useMemo(() => versions.find((v) => v.editable) ?? null, [versions]);

  const [label, setLabel] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || query.isLoading) return;
    const seed = draft ?? published;
    setLabel(draft?.label ?? (published ? `${published.label} (revision)` : "Scoring criteria v1"));
    setCriteria(seed?.criteria.length ? seed.criteria : [{ ...BLANK }, { ...BLANK, weight: 25 }]);
    setHydrated(true);
  }, [draft, published, hydrated, query.isLoading]);

  const problems = validateForPublish(criteria);
  const normalised = normaliseWeights(criteria);

  const save = useMutation({
    mutationFn: () =>
      saveDraft({
        data: {
          position_id: id,
          version_id: draft?.id ?? null,
          label: label.trim() || "Scoring criteria",
          criteria: criteria.map((c) => ({
            ...c,
            key: c.key.trim() || slug(c.label),
            label: c.label.trim(),
            evidence: c.evidence.trim(),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Draft saved");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: (versionId: string) => publish({ data: { version_id: versionId } }),
    onSuccess: () => {
      toast.success("Criteria version published — it is now immutable");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function update(index: number, patch: Partial<CriterionDraft>) {
    setCriteria((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const next = { ...c, ...patch };
        if (patch.label !== undefined && (!c.key || c.key === slug(c.label))) {
          next.key = slug(patch.label);
        }
        return next;
      }),
    );
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link to="/admin/positions/$id" params={{ id }} className="underline">
            {query.data?.position.title ?? "Role"}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Scoring criteria</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Criteria define what this role is scored on. Drafts are editable; a published version is
          immutable and is the only thing a score run may reference, so every candidate score names
          the exact version that produced it.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {draft ? `Editing draft v${draft.version_number}` : "New draft"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-1">
            <label className="text-sm font-medium" htmlFor="criteria-label">
              Version label
            </label>
            <Input
              id="criteria-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Senior nurse — clinical criteria"
            />
          </div>

          <div className="space-y-4">
            {criteria.map((c, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="max-w-xs"
                    value={c.label}
                    onChange={(e) => update(index, { label: e.target.value })}
                    placeholder="Criterion, e.g. Acute-care experience"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      className="w-24"
                      value={c.weight}
                      onChange={(e) => update(index, { weight: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">
                      weight → {normalised[index]?.weight ?? 0}%
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={c.must_have}
                      onCheckedChange={(v) => update(index, { must_have: v === true })}
                    />
                    Must have
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove criterion"
                    onClick={() => setCriteria((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={c.evidence}
                  onChange={(e) => update(index, { evidence: e.target.value })}
                  placeholder="What counts as evidence for this criterion?"
                  rows={2}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCriteria((prev) => [...prev, { ...BLANK }])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add criterion
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!draft || problems.length > 0 || publishMutation.isPending}
              onClick={() => draft && publishMutation.mutate(draft.id)}
            >
              {publishMutation.isPending ? "Publishing…" : "Publish version"}
            </Button>
          </div>

          {problems.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--brand-danger)]">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {!draft && (
            <p className="text-xs text-muted-foreground">
              Save the draft first — publishing acts on a saved draft so the published record is
              exactly what you reviewed.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {versions.length === 0 && (
            <p className="text-muted-foreground">
              No criteria versions yet. Publishing the first version makes scores traceable.
            </p>
          )}
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b py-2 last:border-b-0"
            >
              <span className="font-medium">v{v.version_number}</span>
              <span>{v.label}</span>
              <Badge variant={v.editable ? "outline" : "secondary"}>
                {v.editable ? "Draft" : v.status.replace(/_/g, " ")}
              </Badge>
              {!v.editable && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Immutable
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {v.criteria.length} criteria · {v.scored_runs} candidate score
                {v.scored_runs === 1 ? "" : "s"} used this version
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {(v.approved_at ?? v.created_at).slice(0, 10)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
