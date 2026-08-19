import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge, Loader2 } from "lucide-react";
import {
  getRoleControls,
  setRoleIntensity,
  type RoleControl,
} from "@/lib/control-room.functions";
import {
  INTENSITIES,
  INTENSITY_PRESETS,
  intensityChangeSentence,
  type Intensity,
} from "@/lib/role-intensity";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Prompt 18 — how hard we work each role, in one control.
 * Nothing changes until the effect has been read and confirmed.
 */
export function IntensityDial({
  orgId,
  canEdit,
}: {
  orgId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(getRoleControls);
  const saveFn = useServerFn(setRoleIntensity);
  const [pending, setPending] = useState<
    { role: RoleControl; next: Intensity } | null
  >(null);

  const { data: roles, isPending } = useQuery({
    queryKey: ["role-controls", orgId],
    queryFn: () => listFn({ data: { organization_id: orgId } }),
  });

  const save = useMutation({
    mutationFn: (input: { position_id: string; intensity: Intensity }) =>
      saveFn({ data: { organization_id: orgId, ...input } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["role-controls", orgId] });
      toast.success(
        `${row.title} is now on ${INTENSITY_PRESETS[row.intensity as Intensity].label.toLowerCase()}. It takes effect on the next search.`,
      );
      setPending(null);
    },
    onError: (e) => {
      toast.error(
        e instanceof Error ? e.message : "That change did not save. Nothing changed.",
      );
      setPending(null);
    },
  });

  if (isPending) {
    return <div className="h-32 animate-pulse rounded-lg border border-border bg-muted/40" />;
  }

  if (!roles?.length) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4" aria-hidden /> Search intensity
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          Once a role is live you can set its pace here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4" aria-hidden /> Search intensity
        </h2>

        <p className="text-xs text-muted-foreground">
          Changes take effect on the next run.
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {roles.map((role) => {
          const current = (role.intensity ?? "standard") as Intensity;
          return (
            <li
              key={role.position_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3"
            >
              <div className="min-w-48">
                <p className="text-sm font-medium">{role.title}</p>
                <p className="text-xs text-muted-foreground">
                  {INTENSITY_PRESETS[current].summary}
                </p>
              </div>
              <div
                role="radiogroup"
                aria-label={`Hiring intensity for ${role.title}`}
                className="flex rounded-md border border-border p-0.5"
              >
                {INTENSITIES.map((key) => {
                  const active = key === current;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!canEdit || save.isPending}
                      onClick={() =>
                        !active && setPending({ role, next: key })
                      }
                      className={cn(
                        "rounded px-3 py-1 text-xs transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted",
                        !canEdit && "cursor-not-allowed opacity-60",
                      )}
                    >
                      {INTENSITY_PRESETS[key].label}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>

      {!canEdit && (
        <p className="mt-3 text-xs text-muted-foreground">
          Only a workspace admin can change the pace of a role.
        </p>
      )}

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Change the pace on {pending.role.title}?
                </DialogTitle>
                <DialogDescription>
                  {intensityChangeSentence(
                    (pending.role.intensity ?? "standard") as Intensity,
                    pending.next,
                  )}
                </DialogDescription>
              </DialogHeader>
              <dl className="space-y-2 text-sm">
                {INTENSITY_PRESETS[pending.next].effects.map((e) => (
                  <div key={e.label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{e.label}</dt>
                    <dd className="text-right font-medium">{e.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">
                Best for: {INTENSITY_PRESETS[pending.next].bestFor}
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setPending(null)}>
                  Keep it as it is
                </Button>
                <Button
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate({
                      position_id: pending.role.position_id,
                      intensity: pending.next,
                    })
                  }
                >
                  {save.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Confirm change
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
