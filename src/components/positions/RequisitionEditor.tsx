// Structured requisition layer: multi-country locations, evaluation priorities,
// ownership, compensation permissioning, job-quality gaps, version history and
// controlled rescore. Saves independently of the intake wizard content.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPENSATION_VISIBILITY,
  COUNTRIES,
  DEFAULT_WEIGHTS,
  TRAVEL_EXPECTATIONS,
  WEIGHT_DIMENSIONS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  balanceWeights,
  countryName,
  explainWeights,
  locationLabel,
  requisitionMetaSchema,
  type EvaluationWeights,
  type RequisitionLocation,
} from "@/lib/requisition-schema";
import {
  getRequisitionMeta,
  requestRequisitionRescore,
  saveRequisitionMeta,
} from "@/lib/requisition.functions";

const emptyLocation = (): RequisitionLocation => ({
  country_code: "US",
  region: "",
  city: "",
  work_model: "onsite",
  is_primary: false,
  headcount: null,
  timezone: "",
  onsite_days_per_week: null,
  notes: "",
});

type Form = {
  reference_code: string;
  owner_user_id: string | null;
  travel_expectation: string;
  primary_timezone: string;
  timezone_overlap_hours: number | null;
  target_start_date: string;
  compensation_collected: boolean;
  compensation_visibility: "internal" | "client" | "public";
  currency: string;
  budget_min: string;
  budget_max: string;
  evaluation_weights: EvaluationWeights;
  locations: RequisitionLocation[];
  change_reason: string;
};

export function RequisitionEditor({
  positionId,
  onDirtyChange,
  audience = "admin",
}: {
  positionId: string;
  onDirtyChange?: (dirty: boolean) => void;
  audience?: "admin" | "client";
}) {
  const qc = useQueryClient();
  const load = useServerFn(getRequisitionMeta);
  const save = useServerFn(saveRequisitionMeta);
  const rescore = useServerFn(requestRequisitionRescore);

  const { data: meta, isLoading } = useQuery({
    queryKey: ["requisition-meta", positionId],
    queryFn: () => load({ data: { id: positionId } }),
  });

  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!meta) return;
    setForm({
      reference_code: meta.reference_code,
      owner_user_id: meta.owner_user_id,
      travel_expectation: meta.travel_expectation,
      primary_timezone: meta.primary_timezone,
      timezone_overlap_hours: meta.timezone_overlap_hours,
      target_start_date: meta.target_start_date,
      compensation_collected: meta.compensation_collected,
      compensation_visibility: meta.compensation_visibility,
      currency: meta.currency,
      budget_min: meta.budget_min,
      budget_max: meta.budget_max,
      evaluation_weights: meta.evaluation_weights,
      locations: meta.locations.length ? meta.locations : [{ ...emptyLocation(), is_primary: true }],
      change_reason: "",
    });
  }, [meta]);

  const baseline = useMemo(() => (meta ? JSON.stringify(meta.locations) + JSON.stringify(meta.evaluation_weights) : ""), [meta]);
  const dirty = useMemo(
    () => (form ? JSON.stringify(form.locations) + JSON.stringify(form.evaluation_weights) !== baseline : false),
    [form, baseline],
  );
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setLoc = (i: number, patch: Partial<RequisitionLocation>) =>
    setForm((f) =>
      f ? { ...f, locations: f.locations.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : f,
    );

  const weightTotal = form ? WEIGHT_DIMENSIONS.reduce((s, d) => s + form.evaluation_weights[d.key], 0) : 0;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error("Not ready");
      const parsed = requisitionMetaSchema.safeParse({ position_id: positionId, ...form });
      if (!parsed.success) {
        const msgs = parsed.error.issues.map((i) => i.message);
        setErrors(msgs);
        throw new Error(msgs[0]);
      }
      setErrors([]);
      return save({ data: parsed.data });
    },
    onSuccess: async (res) => {
      toast.success(
        res.rescore_required
          ? "Requisition saved — a rescore is pending for this job."
          : "Requisition saved",
      );
      await qc.invalidateQueries({ queryKey: ["requisition-meta", positionId] });
    },
    onError: (e) => toastError(e, { fallback: "Save failed" }),
  });

  const rescoreMutation = useMutation({
    mutationFn: async () => rescore({ data: { id: positionId, reason: form?.change_reason ?? "" } }),
    onSuccess: async (res) => {
      toast.success(`Rescore event recorded for ${res.candidates_affected} candidate(s)`);
      await qc.invalidateQueries({ queryKey: ["requisition-meta", positionId] });
    },
    onError: (e) => toastError(e, { fallback: "Could not start rescore" }),
  });

  if (isLoading || !form || !meta) {
    return <p className="text-sm text-muted-foreground">Loading requisition details…</p>;
  }

  return (
    <div className="space-y-6">
      {meta.rescore_state !== "current" && (
        <div className="rounded-md border border-[hsl(var(--warning,45_90%_45%))]/40 bg-muted/50 p-3">
          <p className="text-sm font-medium">Scoring-relevant detail changed (v{meta.content_version})</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Existing candidate scores were produced against an earlier version of this job. Nothing has been
            rewritten — start a rescore to evaluate them against the current requisition.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="Reason for the change (optional)"
              value={form.change_reason}
              onChange={(e) => set("change_reason", e.target.value)}
            />
            <Button size="sm" onClick={() => rescoreMutation.mutate()} disabled={rescoreMutation.isPending}>
              {rescoreMutation.isPending ? "Recording…" : "Start controlled rescore"}
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- Locations ---------------- */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Locations</CardTitle>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => set("locations", [...form.locations, emptyLocation()])}
          >
            Add location
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            One job, many places. Each location carries its own work model so eligibility and timezone checks stay
            accurate across countries.
          </p>
          {form.locations.map((l, i) => (
            <div key={l.id ?? `new-${i}`} className="rounded-md border p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Country</Label>
                  <Select value={l.country_code} onValueChange={(v) => setLoc(i, { country_code: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">State / region</Label>
                  <Input value={l.region} onChange={(e) => setLoc(i, { region: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input value={l.city} onChange={(e) => setLoc(i, { city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Work model</Label>
                  <Select
                    value={l.work_model}
                    onValueChange={(v) =>
                      setLoc(i, {
                        work_model: v as RequisitionLocation["work_model"],
                        onsite_days_per_week: v === "remote" ? null : l.onsite_days_per_week,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">On-site</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">On-site days / week</Label>
                  <Input
                    type="number"
                    min={0}
                    max={7}
                    disabled={l.work_model === "remote"}
                    value={l.onsite_days_per_week ?? ""}
                    onChange={(e) =>
                      setLoc(i, {
                        onsite_days_per_week: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Openings here</Label>
                  <Input
                    type="number"
                    min={1}
                    value={l.headcount ?? ""}
                    onChange={(e) =>
                      setLoc(i, { headcount: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Local timezone</Label>
                  <Input
                    placeholder="e.g. Europe/Berlin"
                    value={l.timezone}
                    onChange={(e) => setLoc(i, { timezone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Working conditions / notes</Label>
                  <Input value={l.notes} onChange={(e) => setLoc(i, { notes: e.target.value })} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={l.is_primary}
                    onCheckedChange={(c) =>
                      set(
                        "locations",
                        form.locations.map((x, idx) => ({ ...x, is_primary: idx === i ? c === true : false })),
                      )
                    }
                  />
                  Primary location
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{locationLabel(l) || countryName(l.country_code)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => set("locations", form.locations.filter((_, idx) => idx !== i))}
                    disabled={form.locations.length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ---------------- Logistics & ownership ---------------- */}
      <Card>
        <CardHeader><CardTitle className="text-base">Logistics, reference & ownership</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Internal reference ID</Label>
            <Input
              value={form.reference_code}
              placeholder="Generated automatically"
              readOnly
              disabled
              aria-readonly="true"
            />
            <p className="text-xs text-muted-foreground">
              Generated for you, unique per client. Nothing to fill in.
            </p>
          </div>
          {audience === "admin" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Responsible admin</Label>
              <Select
                value={form.owner_user_id ?? "none"}
                onValueChange={(v) => set("owner_user_id", v === "none" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {meta.owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Travel expectation</Label>
            <Select value={form.travel_expectation || "unset"} onValueChange={(v) => set("travel_expectation", v === "unset" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not specified</SelectItem>
                {TRAVEL_EXPECTATIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anchor timezone</Label>
            <Input
              placeholder="e.g. UTC+1 / America/New_York"
              value={form.primary_timezone}
              onChange={(e) => set("primary_timezone", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Required overlap (hours/day)</Label>
            <Input
              type="number"
              min={0}
              max={12}
              value={form.timezone_overlap_hours ?? ""}
              onChange={(e) =>
                set("timezone_overlap_hours", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Target start date</Label>
            <Input
              type="date"
              value={form.target_start_date ? form.target_start_date.slice(0, 10) : ""}
              onChange={(e) => set("target_start_date", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Compensation (permissioned) ---------------- */}
      <Card>
        <CardHeader><CardTitle className="text-base">Compensation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!meta.can_edit_compensation ? (
            <p className="text-sm text-muted-foreground">
              {form.compensation_collected
                ? "Compensation is recorded for this job. Only the TaaSFlow team can change how it is collected or shared."
                : "No compensation has been collected for this job."}
            </p>
          ) : (
            <>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={form.compensation_collected}
                  onCheckedChange={(c) => set("compensation_collected", c === true)}
                />
                <span>
                  Compensation was intentionally collected for this role
                  <span className="block text-xs text-muted-foreground">
                    Leave off and nothing is stored — we never infer a budget.
                  </span>
                </span>
              </label>
              {form.compensation_collected && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Currency</Label>
                    <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Minimum</Label>
                    <Input value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Maximum</Label>
                    <Input value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Who may see it</Label>
                    <Select
                      value={form.compensation_visibility}
                      onValueChange={(v) => set("compensation_visibility", v as Form["compensation_visibility"])}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COMPENSATION_VISIBILITY.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Evaluation priorities ---------------- */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evaluation priorities</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Adjust what matters most for this role. Each dimension stays between {WEIGHT_MIN}% and {WEIGHT_MAX}% so
            no single signal can decide a shortlist, and the mix is rebalanced to 100% on save.
          </p>
          {WEIGHT_DIMENSIONS.map((d) => (
            <div key={d.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm">{d.label}</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {form.evaluation_weights[d.key]}%
                </span>
              </div>
              <Slider
                value={[form.evaluation_weights[d.key]]}
                min={WEIGHT_MIN}
                max={WEIGHT_MAX}
                step={1}
                aria-label={d.label}
                onValueChange={([v]) =>
                  set("evaluation_weights", { ...form.evaluation_weights, [d.key]: v })
                }
              />
              <p className="text-xs text-muted-foreground">{d.help}</p>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{explainWeights(form.evaluation_weights)}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums">Total {weightTotal}%</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => set("evaluation_weights", balanceWeights(form.evaluation_weights))}
              >
                Rebalance to 100%
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => set("evaluation_weights", { ...DEFAULT_WEIGHTS })}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Version history ---------------- */}
      <Card>
        <CardHeader><CardTitle className="text-base">Edit history</CardTitle></CardHeader>
        <CardContent>
          {meta.versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scoring-relevant changes yet. Version 1 is the original requisition.
            </p>
          ) : (
            <ol className="space-y-2 text-sm">
              {meta.versions.map((v) => (
                <li key={v.version_number} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
                  <span>
                    v{v.version_number} · {v.title || "Untitled"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()} · {v.created_by_name}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <ul className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {dirty ? "Unsaved changes to locations or priorities." : "All requisition details saved."}
        </p>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save requisition details"}
        </Button>
      </div>
    </div>
  );
}

/** Free-text notes stay clearly separate from structured fields. */
export function FreeTextNote({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Free-text job description (not used as structured data)</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} />
    </div>
  );
}
