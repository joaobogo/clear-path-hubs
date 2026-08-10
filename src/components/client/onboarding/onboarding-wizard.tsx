import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { toastError } from \"@/lib/toast-error\";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowRight, Loader2, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { GeneratedBlueprintPanel } from "@/components/positions/generated-blueprint-panel";
import { INTENSITY_PRESETS, INTENSITIES, type Intensity } from "@/lib/role-intensity";
import { DEFAULT_WEIGHTS, type EvaluationWeights } from "@/lib/requisition-schema";
import {
  DEFAULT_OPTIONAL_GATES,
  ONBOARDING_STEPS,
  OVERSIGHT_GATES,
  remainingMinutes,
  stepById,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps";
import {
  ReviewRow,
  SequenceProgress,
  StepFooter,
  StepHeader,
  StepRail,
  TagListEditor,
  WeightEditor,
} from "@/components/client/onboarding/step-shell";
import {
  confirmOnboardingBlueprint,
  confirmOnboardingStep,
  getOnboardingState,
  saveOnboardingOversight,
  saveOnboardingPlace,
  saveOnboardingRequirements,
  saveOnboardingRole,
  saveOnboardingWeights,
  saveOnboardingWorkspace,
} from "@/lib/onboarding.functions";
import { retryBlueprintAnalysis } from "@/lib/blueprint.functions";
import { setRoleIntensity } from "@/lib/control-room.functions";
import { EmptyState, ErrorState, PermissionDenied, SkeletonRows } from "@/components/client/states";

/**
 * First-run sequence — ten steps that configure the hiring system rather than
 * collecting a form. Progress is derived from real records, so a half-finished
 * setup survives a refresh, a new device, or a week away.
 *
 * Nothing here bypasses controls: publication still runs through the payment
 * gate, candidate release still requires review, and contact release stays a
 * separate permission.
 */
export function OnboardingWizard({ orgId }: { orgId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getOnboardingState);

  const stateQuery = useQuery({
    queryKey: ["onboarding-state", orgId ?? null],
    queryFn: () => fetchState({ data: orgId ? { organization_id: orgId } : {} }),
    staleTime: 10_000,
  });

  const state = stateQuery.data;
  const [step, setStep] = useState<OnboardingStepId | null>(null);
  const active = step ?? state?.current_step ?? "workspace";
  const activeStep = stepById(active);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });

  const savePlace = useServerFn(saveOnboardingPlace);
  const confirmStep = useServerFn(confirmOnboardingStep);

  const goTo = (next: OnboardingStepId) => {
    setStep(next);
    void savePlace({ data: { current_step: next, position_id: state?.position?.id ?? null } });
  };

  const markConfirmed = useMutation({
    mutationFn: async (id: OnboardingStepId) => {
      if (!state?.organization_id) return;
      await confirmStep({ data: { organization_id: state.organization_id, step: id } });
    },
    onSuccess: invalidate,
  });

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === active);
  const back = stepIndex > 0 ? () => goTo(ONBOARDING_STEPS[stepIndex - 1]!.id) : undefined;
  const forward = () => {
    const next = ONBOARDING_STEPS[stepIndex + 1];
    if (next) goTo(next.id);
  };
  const saveForLater = () => {
    void savePlace({ data: { current_step: active, position_id: state?.position?.id ?? null } });
    toast.success("Saved. You can pick this up from where you left off.");
    void navigate({ to: "/client" });
  };

  if (stateQuery.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonRows rows={6} />
      </div>
    );
  }

  if (stateQuery.isError) {
    return (
      <ErrorState
        title="We could not load your setup"
        description="Your saved answers are safe. Try again in a moment."
        detail={
          stateQuery.error instanceof Error ? stateQuery.error.message : null
        }
        onRetry={() => void stateQuery.refetch()}
      />
    );
  }

  if (!state?.organization_id) {
    return (
      <EmptyState
        title="No workspace yet"
        description="This setup starts once a workspace exists."
        whatAppearsHere="Once your workspace is created, the ten setup steps appear here."
        action={{ label: "Start intake", to: "/intake" }}
      />
    );
  }

  if (!state.can_configure) {
    return (
      <PermissionDenied
        title="You can follow this setup but not change it"
        description="Your seat is read-only for configuration. Ask a workspace admin to complete setup, or to give you edit access."
      />
    );
  }

  return (
    <div id="ob-wizard" className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <SequenceProgress
          complete={state.complete}
          remaining={remainingMinutes(state.complete)}
          active={active}
        />

        <StepRail
          steps={ONBOARDING_STEPS}
          active={active}
          complete={state.complete}
          onSelect={goTo}
        />
        {state.draft_saved_at && (
          <p className="text-xs text-muted-foreground">
            Progress saved {new Date(state.draft_saved_at).toLocaleString()}
          </p>
        )}
      </aside>

      <Card>
        <CardContent className="space-y-6 p-6">
          <StepHeader step={activeStep} />
          <StepBody
            id={active}
            state={state}
            onDone={async (opts) => {
              await invalidate();
              if (opts?.confirm) await markConfirmed.mutateAsync(active);
              if (opts?.advance !== false) forward();
            }}
            goTo={goTo}
            back={back}
            saveForLater={saveForLater}
          />
        </CardContent>
      </Card>
    </div>
  );
}

type State = NonNullable<ReturnType<typeof useOnboardingStateType>>;
// Helper purely for typing the state prop from the server function's return.
declare function useOnboardingStateType(): Awaited<ReturnType<typeof getOnboardingState>>;

type DoneOpts = { confirm?: boolean; advance?: boolean };
type BodyProps = {
  id: OnboardingStepId;
  state: State;
  onDone: (opts?: DoneOpts) => Promise<void>;
  goTo: (id: OnboardingStepId) => void;
  back?: () => void;
  saveForLater: () => void;
};

function StepBody(props: BodyProps) {
  switch (props.id) {
    case "workspace":
      return <WorkspaceStep {...props} />;
    case "role":
      return <RoleStep {...props} />;
    case "requirements":
      return <RequirementsStep {...props} />;
    case "blueprint":
      return <BlueprintStep {...props} />;
    case "weights":
      return <WeightsStep {...props} />;
    case "agents":
      return <AgentsStep {...props} />;
    case "oversight":
      return <OversightStep {...props} />;
    case "systems":
      return <SystemsStep {...props} />;
    case "run":
      return <RunStep {...props} />;
    case "workspace_entry":
      return <EntryStep {...props} />;
  }
}

function NoRoleYet({ goTo }: { goTo: (id: OnboardingStepId) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This step needs a role first. Go back to step 2 and name the role you want to hire.
      </p>
      <Button type="button" onClick={() => goTo("role")}>
        Define the first role
      </Button>
    </div>
  );
}

/* ---------------------------------- 1 ---------------------------------- */

function WorkspaceStep({ state, onDone, saveForLater }: BodyProps) {
  const save = useServerFn(saveOnboardingWorkspace);
  const [form, setForm] = useState({
    name: state.workspace?.name ?? "",
    website: state.workspace?.website ?? "",
    industry: state.workspace?.industry ?? "",
    headquarters: state.workspace?.headquarters ?? "",
  });
  const mutation = useMutation({
    mutationFn: () =>
      save({ data: { organization_id: state.organization_id!, ...form } }),
    onSuccess: async () => {
      toast.success("Workspace confirmed.");
      await onDone();
    },
    onError: (e: Error) => toastError(e),
  });

  if (!state.is_admin) {
    return (
      <div className="space-y-6">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Workspace</dt>
            <dd className="font-medium">{state.workspace?.name}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          Only a workspace admin can change these details. You can continue with setup.
        </p>
        <StepFooter
          step={stepById("workspace")}
          onContinue={() => void onDone({ confirm: true })}
          continueLabel="Continue"
          onSave={saveForLater}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ob-name">Company name</Label>
          <Input
            id="ob-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-website">Website</Label>
          <Input
            id="ob-website"
            placeholder="company.com"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-industry">Industry</Label>
          <Input
            id="ob-industry"
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ob-hq">Headquarters</Label>
          <Input
            id="ob-hq"
            value={form.headquarters}
            onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
          />
        </div>
      </div>
      <StepFooter
        step={stepById("workspace")}
        onContinue={() => mutation.mutate()}
        saving={mutation.isPending}
        continueDisabled={form.name.trim().length < 2}
        onSave={saveForLater}
      />
    </div>
  );
}

/* ---------------------------------- 2 ---------------------------------- */

const WORK_MODEL_OPTIONS = [
  { value: "onsite", label: "On site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];
const EMPLOYMENT_OPTIONS = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
];

function RoleStep({ state, onDone, back, saveForLater }: BodyProps) {
  const save = useServerFn(saveOnboardingRole);
  const pos = state.position;
  const [selected, setSelected] = useState<string>(pos?.id ?? "new");
  const [form, setForm] = useState({
    title: pos?.title ?? "",
    location: pos?.location ?? "",
    work_model: pos?.work_model ?? "",
    employment_type: pos?.employment_type ?? "",
    seniority: pos?.seniority ?? "",
    description: pos?.description ?? "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          organization_id: state.organization_id!,
          position_id: selected === "new" ? null : selected,
          ...form,
          work_model: form.work_model as "" | "remote" | "hybrid" | "onsite",
          employment_type: form.employment_type as
            | ""
            | "full_time"
            | "part_time"
            | "contract"
            | "temporary"
            | "internship",
        },
      }),
    onSuccess: async () => {
      toast.success("Role saved.");
      await onDone();
    },
    onError: (e: Error) => toastError(e),
  });

  return (
    <div className="space-y-6">
      {state.positions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="ob-role-select">Which role are we configuring?</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="ob-role-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.positions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title || "Untitled role"}
                </SelectItem>
              ))}
              <SelectItem value="new">Add a new role</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ob-title">Role title</Label>
          <Input
            id="ob-title"
            value={form.title}
            placeholder="Head of Operations"
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-location">Location</Label>
          <Input
            id="ob-location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-seniority">Seniority</Label>
          <Input
            id="ob-seniority"
            value={form.seniority}
            placeholder="Senior, Head of, Director"
            onChange={(e) => setForm({ ...form, seniority: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-work-model">Work model</Label>
          <Select
            value={form.work_model || undefined}
            onValueChange={(v) => setForm({ ...form, work_model: v })}
          >
            <SelectTrigger id="ob-work-model">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {WORK_MODEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ob-employment">Employment type</Label>
          <Select
            value={form.employment_type || undefined}
            onValueChange={(v) => setForm({ ...form, employment_type: v })}
          >
            <SelectTrigger id="ob-employment">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="ob-description">Job description or brief</Label>
          <Textarea
            id="ob-description"
            rows={6}
            value={form.description}
            placeholder="Paste the job description. The system reads it when it compiles the blueprint."
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </div>

      <StepFooter
        step={stepById("role")}
        onBack={back}
        onContinue={() => mutation.mutate()}
        saving={mutation.isPending}
        continueDisabled={form.title.trim().length < 2}
        onSave={saveForLater}
      />
    </div>
  );
}

/* ---------------------------------- 3 ---------------------------------- */

function RequirementsStep({ state, onDone, back, saveForLater, goTo }: BodyProps) {
  const save = useServerFn(saveOnboardingRequirements);
  const pos = state.position;
  const [must, setMust] = useState<string[]>(pos?.must_haves ?? []);
  const [nice, setNice] = useState<string[]>(pos?.nice_to_haves ?? []);
  const [breakers, setBreakers] = useState<string[]>(pos?.dealbreakers ?? []);
  const [criteria, setCriteria] = useState(pos?.success_criteria ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          organization_id: state.organization_id!,
          position_id: pos!.id,
          must_haves: must,
          nice_to_haves: nice,
          dealbreakers: breakers,
          success_criteria: criteria,
        },
      }),
    onSuccess: async () => {
      toast.success("Requirements saved.");
      await onDone();
    },
    onError: (e: Error) => toastError(e),
  });

  if (!pos) return <NoRoleYet goTo={goTo} />;

  return (
    <div className="space-y-6">
      <TagListEditor
        label="Must-haves"
        help="Scored on every candidate. Add at least three."
        items={must}
        onChange={setMust}
        placeholder="Managed a multi-site P&L"
      />
      <TagListEditor
        label="Nice-to-haves"
        help="Improve ranking, never exclude anyone."
        items={nice}
        onChange={setNice}
        placeholder="Worked in a private-equity backed business"
      />
      <TagListEditor
        label="Dealbreakers"
        help="Checked before scoring. A candidate who fails one does not reach you."
        items={breakers}
        onChange={setBreakers}
        placeholder="No right to work in the UK"
      />
      <div className="space-y-2">
        <Label htmlFor="ob-criteria">What does success look like in the first year?</Label>
        <Textarea
          id="ob-criteria"
          rows={4}
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder="Two or three outcomes this person owns."
        />
      </div>
      <StepFooter
        step={stepById("requirements")}
        onBack={back}
        onContinue={() => mutation.mutate()}
        saving={mutation.isPending}
        continueDisabled={must.length < 3}
        onSave={saveForLater}
      />
    </div>
  );
}

/* ---------------------------------- 4 ---------------------------------- */

const RUNNING_STATES = ["queued", "analyzing_jd", "researching", "compiling"];

function BlueprintStep({ state, onDone, back, saveForLater, goTo }: BodyProps) {
  const confirm = useServerFn(confirmOnboardingBlueprint);
  const retry = useServerFn(retryBlueprintAnalysis);
  const pos = state.position;
  const status = pos?.blueprint_status ?? "not_started";
  const running = RUNNING_STATES.includes(status);

  // While the compiler is working, keep the view current without a manual refresh.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void onDone({ advance: false }), 6000);
    return () => clearInterval(t);
  }, [running, onDone]);

  const compile = useMutation({
    mutationFn: () => retry({ data: { positionId: pos!.id } }),
    onSuccess: async (res) => {
      if (res?.ok) toast.success("Compiling the blueprint now.");
      else toast.info("The compiler is already working on this role.");
      await onDone({ advance: false });
    },
    onError: (e: Error) => toastError(e),
  });

  const accept = useMutation({
    mutationFn: () =>
      confirm({ data: { organization_id: state.organization_id!, position_id: pos!.id } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error("The blueprint is not ready to confirm yet.");
        return;
      }
      toast.success("Blueprint confirmed.");
      await onDone();
    },
    onError: (e: Error) => toastError(e),
  });

  if (!pos) return <NoRoleYet goTo={goTo} />;

  return (
    <div className="space-y-6">
      {status === "not_started" || status === "none" ? (
        <div className="space-y-4 rounded-lg border border-border/70 p-4">
          <p className="text-sm text-muted-foreground">
            Nothing compiled yet. The system reads your requirements and the job description,
            then proposes a rubric and a sourcing plan for you to check.
          </p>
          <Button type="button" onClick={() => compile.mutate()} disabled={compile.isPending}>
            {compile.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            Compile the blueprint
          </Button>
        </div>
      ) : status === "failed" ? (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" aria-hidden />
            The compile did not finish
          </p>
          <p className="text-sm text-muted-foreground">
            {pos.blueprint_error ?? "Your inputs are saved. Nothing was lost."}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => compile.mutate()}
            disabled={compile.isPending}
          >
            <RefreshCw className="mr-2 size-4" aria-hidden />
            Try again
          </Button>
        </div>
      ) : (
        <GeneratedBlueprintPanel
          position={{
            id: pos.id,
            title: pos.title,
            blueprint: pos.blueprint,
            blueprint_status: pos.blueprint_status,
            blueprint_error: pos.blueprint_error,
            blueprint_generated_at: pos.blueprint_generated_at,
            blueprint_confirmed_at: pos.blueprint_confirmed_at,
            description: pos.description,
          }}
          audience="client"
        />
      )}

      <StepFooter
        step={stepById("blueprint")}
        onBack={back}
        onContinue={() => accept.mutate()}
        saving={accept.isPending}
        continueDisabled={!["generated", "ready", "confirmed"].includes(status)}
        continueLabel={
          pos.blueprint_confirmed_at ? "Continue" : "This looks right — continue"
        }
        onSave={saveForLater}
      />
    </div>
  );
}

/* ---------------------------------- 5 ---------------------------------- */

function WeightsStep({ state, onDone, back, saveForLater, goTo }: BodyProps) {
  const save = useServerFn(saveOnboardingWeights);
  const pos = state.position;
  const [weights, setWeights] = useState<EvaluationWeights>(
    pos?.weights ?? { ...DEFAULT_WEIGHTS },
  );
  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          organization_id: state.organization_id!,
          position_id: pos!.id,
          weights,
        },
      }),
    onSuccess: async (res) => {
      setWeights(res.weights);
      toast.success("Scoring weights saved.");
      await onDone();
    },
    onError: (e: Error) => toastError(e),
  });

  if (!pos) return <NoRoleYet goTo={goTo} />;

  return (
    <div className="space-y-6">
      <WeightEditor weights={weights} onChange={setWeights} disabled={mutation.isPending} />
      <StepFooter
        step={stepById("weights")}
        onBack={back}
        onContinue={() => mutation.mutate()}
        saving={mutation.isPending}
        onSave={saveForLater}
      />
    </div>
  );
}

/* ---------------------------------- 6 ---------------------------------- */

function AgentsStep({ state, onDone, back, saveForLater, goTo }: BodyProps) {
  const setIntensity = useServerFn(setRoleIntensity);
  const pos = state.position;
  const [choice, setChoice] = useState<Intensity>(
    (pos?.intensity as Intensity) ?? "standard",
  );
  const mutation = useMutation({
    mutationFn: () => setIntensity({ data: { positionId: pos!.id, intensity: choice } }),
    onSuccess: async () => {
      toast.success(`Operating level set to ${INTENSITY_PRESETS[choice].label}.`);
      await onDone({ confirm: true });
    },
    onError: (e: Error) => toastError(e),
  });

  if (!pos) return <NoRoleYet goTo={goTo} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {INTENSITIES.map((key) => {
          const preset = INTENSITY_PRESETS[key];
          const selected = choice === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setChoice(key)}
              aria-pressed={selected}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <p className="font-medium">{preset.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{preset.summary}</p>
            </button>
          );
        })}
      </div>
      <dl className="space-y-2 rounded-lg border border-border/70 p-4 text-sm">
        {INTENSITY_PRESETS[choice].effects.map((e) => (
          <div key={e.label} className="flex flex-wrap justify-between gap-2">
            <dt className="text-muted-foreground">{e.label}</dt>
            <dd className="font-medium">{e.value}</dd>
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-2 border-t border-border/60 pt-2">
          <dt className="text-muted-foreground">Best for</dt>
          <dd className="max-w-sm text-right">{INTENSITY_PRESETS[choice].bestFor}</dd>
        </div>
      </dl>
      <StepFooter
        step={stepById("agents")}
        onBack={back}
        onContinue={() => mutation.mutate()}
        saving={mutation.isPending}
        onSave={saveForLater}
      />
    </div>
  );
}

/* ---------------------------------- 7 ---------------------------------- */

function OversightStep({ state, onDone, back, saveForLater, goTo }: BodyProps) {
  const save = useServerFn(saveOnboardingOversight);
  const pos = state.position;
  const initial = useMemo(() => {
    const saved = pos?.oversight ?? {};
    const out: Record<string, boolean> = { ...DEFAULT_OPTIONAL_GATES };
    for (const gate of OVERSIGHT_GATES) {
      if (gate.locked) continue;
      if (typeof saved[gate.key] === "boolean") out[gate.key] = saved[gate.key] as boolean;
    }
    return out;
  }, [pos?.oversight]);
  const [gates, setGates] = useState(initial);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: { organization_id: state.organization_id!, position_id: pos!.id, gates },
      }),
    onSuccess: async () => {
      toast.success("Oversight gates saved.");
      await onDone();
    },
    onError: (e: Error) => toastError(e),
  });

  if (!pos) return <NoRoleYet goTo={goTo} />;

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {OVERSIGHT_GATES.map((gate) => (
          <li
            key={gate.key}
            className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-4"
          >
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {gate.locked && <Lock className="size-3.5 text-muted-foreground" aria-hidden />}
                {gate.label}
              </p>
              <p className="text-sm text-muted-foreground">{gate.detail}</p>
            </div>
            {gate.locked ? (
              <Badge variant="secondary" className="shrink-0">
                Always on
              </Badge>
            ) : (
              <Switch
                checked={gates[gate.key] ?? false}
                onCheckedChange={(v) => setGates({ ...gates, [gate.key]: v })}
                aria-label={gate.label}
              />
            )}
          </li>
        ))}
      </ul>
      <StepFooter
        step={stepById("oversight")}
        onBack={back}
        onContinue={() => mutation.mutate()}
        saving={mutation.isPending}
        onSave={saveForLater}
      />
    </div>
  );
}

/* ---------------------------------- 8 ---------------------------------- */

const HEALTH_LABEL: Record<string, string> = {
  healthy: "Connected",
  degraded: "Needs attention",
  failing: "Not working",
  not_configured: "Not connected",
};

function SystemsStep({ state, onDone, back, saveForLater }: BodyProps) {
  const connected = state.integrations.length > 0;
  return (
    <div className="space-y-6">
      {!connected ? (
        <div className="space-y-3 rounded-lg border border-border/70 p-4">
          <p className="text-sm font-medium">Nothing connected yet</p>
          <p className="text-sm text-muted-foreground">
            Connections are optional. Without them, interviews are scheduled with links you send
            yourself and updates arrive by email from TaaSFlow.
          </p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>Calendar — interview slots booked straight into your availability.</li>
            <li>Email — candidate threads kept in your own inbox.</li>
            <li>Messaging — shortlist and decision alerts in your team channel.</li>
          </ul>
          <Button asChild type="button" variant="outline" size="sm">
            <Link to="/client/account" search={{ tab: "workspace" }}>Connect a system</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
          {state.integrations.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-4 p-3 text-sm">
              <span className="font-medium capitalize">{i.id.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground">
                {HEALTH_LABEL[i.status] ?? i.status}
                {i.checked_at ? ` · checked ${new Date(i.checked_at).toLocaleDateString()}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        You can add or remove connections any time from{" "}
        <Link to="/client/account" search={{ tab: "workspace" }} className="underline">
          your account settings
        </Link>
        .
      </p>
      <StepFooter
        step={stepById("systems")}
        onBack={back}
        onContinue={() => void onDone({ confirm: true })}
        continueLabel={connected ? "Continue" : "Continue without connections"}
        onSave={saveForLater}
      />
    </div>
  );
}


/* ---------------------------------- 9 ---------------------------------- */

function RunStep({ state, onDone, back, saveForLater, goTo }: BodyProps) {
  const retry = useServerFn(retryBlueprintAnalysis);
  const pos = state.position;
  const blockers: string[] = [];
  if (pos && pos.must_haves.length < 3) blockers.push("Add at least three must-have requirements.");
  if (pos && !pos.blueprint_confirmed_at) blockers.push("Confirm the compiled blueprint.");
  if (pos && !pos.weights_set) blockers.push("Set the scoring weights.");
  if (!state.billing.role_paid && !state.billing.entitlement_available) {
    blockers.push("Complete checkout so the role can be published.");
  }

  const start = useMutation({
    mutationFn: () => retry({ data: { positionId: pos!.id } }),
    onSuccess: async (res) => {
      if (res?.ok) toast.success("The first run has started.");
      else toast.info("A run is already in progress for this role.");
      await onDone();
    },
    onError: (e: Error) => toastError(e),
  });

  if (!pos) return <NoRoleYet goTo={goTo} />;

  return (
    <div className="space-y-6">
      <dl className="space-y-2 rounded-lg border border-border/70 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{pos.title}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Requirements scored</dt>
          <dd className="font-medium">{pos.must_haves.length}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Operating level</dt>
          <dd className="font-medium">{INTENSITY_PRESETS[(pos.intensity as Intensity) ?? "standard"]?.label}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Billing</dt>
          <dd className="font-medium">
            {state.billing.role_paid
              ? "Cleared"
              : state.billing.entitlement_available
                ? "Covered by your plan"
                : "Checkout outstanding"}
          </dd>
        </div>
      </dl>

      {blockers.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-medium">Before the first run</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {!state.billing.role_paid && !state.billing.entitlement_available && (
            <Button asChild variant="outline" size="sm">
              <Link to="/client/positions/$id" params={{ id: pos.id }}>
                Open the role to finish checkout
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          Everything the system needs is in place.
        </p>
      )}

      <StepFooter
        step={stepById("run")}
        onBack={back}
        onContinue={() => start.mutate()}
        saving={start.isPending}
        continueDisabled={blockers.length > 0}
        continueLabel="Start the first run"
        onSave={saveForLater}
      />
    </div>
  );
}

/* --------------------------------- 10 ---------------------------------- */

function EntryStep({ state, onDone, back, goTo }: BodyProps) {
  const navigate = useNavigate();
  const pos = state.position;
  const finish = useMutation({
    mutationFn: async () => {
      await onDone({ confirm: true, advance: false });
    },
    onSuccess: () => {
      void navigate(
        pos
          ? { to: "/client/positions/$id", params: { id: pos.id } }
          : { to: "/client" },
      );
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/70">
        <div className="p-4">
          <p className="text-sm font-medium">Your configuration</p>
        </div>
        <div className="px-4 pb-2">
          <ReviewRow
            label="Workspace"
            value={state.workspace?.name || "Not set"}
            done={state.complete.includes("workspace")}
            onEdit={() => goTo("workspace")}
          />
          <ReviewRow
            label="First role"
            value={pos?.title || "Not set"}
            done={state.complete.includes("role")}
            onEdit={() => goTo("role")}
          />
          <ReviewRow
            label="Requirements"
            value={
              pos ? `${pos.must_haves.length} must-haves, ${pos.dealbreakers.length} dealbreakers` : "Not set"
            }
            done={state.complete.includes("requirements")}
            onEdit={() => goTo("requirements")}
          />
          <ReviewRow
            label="Blueprint"
            value={pos?.blueprint_confirmed_at ? "Confirmed" : "Not confirmed"}
            done={state.complete.includes("blueprint")}
            onEdit={() => goTo("blueprint")}
          />
          <ReviewRow
            label="Scoring weights"
            value={pos?.weights_set ? "Set for this role" : "Using defaults"}
            done={state.complete.includes("weights")}
            onEdit={() => goTo("weights")}
          />
          <ReviewRow
            label="Operating level"
            value={INTENSITY_PRESETS[(pos?.intensity as Intensity) ?? "standard"]?.label ?? "Standard"}
            done={state.complete.includes("agents")}
            onEdit={() => goTo("agents")}
          />
          <ReviewRow
            label="Oversight gates"
            value={
              pos && Object.keys(pos.oversight).length > 0 ? "Configured" : "Not configured"
            }
            done={state.complete.includes("oversight")}
            onEdit={() => goTo("oversight")}
          />
          <ReviewRow
            label="Connections"
            value={`${state.integrations.filter((i) => i.status === "healthy").length} connected`}
            done={state.complete.includes("systems")}
            onEdit={() => goTo("systems")}
          />
          <ReviewRow
            label="First run"
            value={state.complete.includes("run") ? "Started" : "Not started"}
            done={state.complete.includes("run")}
            onEdit={() => goTo("run")}
          />
        </div>
      </div>

      <StepFooter
        step={stepById("workspace_entry")}
        onBack={back}
        onContinue={() => finish.mutate()}
        saving={finish.isPending}
        continueLabel="Enter the Decision Workspace"
      />
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ArrowRight className="size-3" aria-hidden />
        Candidates appear here only after review. Contact details are released separately.
      </p>
    </div>
  );
}
