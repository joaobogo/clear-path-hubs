/**
 * Per-event notification preferences for a client workspace.
 *
 * One row per event, each saving on its own with its own confirmation. A failed
 * save reverts that row visibly and says "That did not save" — the UI never
 * shows a value the server did not accept.
 *
 * Overdue decisions and information requests can be moved to the digest but not
 * switched off, and the row states the reason rather than hiding the control.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QueryErrorCard } from "@/components/client/query-error";
import { useQueryState } from "@/hooks/use-query-state";
import {
  getClientNotificationPreferences,
  updateClientNotificationPreference,
} from "@/lib/notification-prefs.functions";
import { toastError } from "@/lib/toast-error";
import {
  NOTIFICATION_EVENTS,
  defaultPreferences,
  modeLabelFor,
  specFor,
  type DeliveryMode,
  type PreferenceKey,
  type PreferenceRow,
} from "@/lib/client-notification-prefs";

export function NotificationPreferences({
  orgId,
  canEdit,
}: {
  orgId: string;
  canEdit: boolean;
}) {
  const getFn = useServerFn(getClientNotificationPreferences);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["client-notification-prefs", orgId],
    queryFn: () => getFn({ data: { orgId } }),
  });
  const state = useQueryState(query);

  const [row, setRow] = useState<PreferenceRow>(defaultPreferences());
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  useEffect(() => {
    if (state.data?.preferences) setRow(state.data.preferences);
  }, [state.data]);

  const updateFn = useServerFn(updateClientNotificationPreference);
  const save = useMutation({
    mutationFn: (vars: { key: PreferenceKey; mode: DeliveryMode }) =>
      updateFn({ data: { orgId, ...vars } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-notification-prefs", orgId] });
    },
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't save. Nothing was saved — please try again." }),
  });

  const usingDefaults = state.data?.usingDefaults ?? false;

  const commit = async (key: PreferenceKey, mode: DeliveryMode) => {
    if (!canEdit || savingKey) return;
    // Always allow the save: the server is the source of truth, and the user
    // expects a confirmation toast every time they pick a value. This avoids
    // stale local-state guards that can block a legitimate change back.
    setRow((r) => ({ ...r, [key]: mode }));
    setSavingKey(key);
    try {
      await save.mutateAsync({ key, mode });
      toast.success(`Saved — ${modeLabelFor(specFor(key), mode).toLowerCase()}`);
    } catch (e) {
      // Revert visibly: the row goes back to the value the server still holds.
      const serverValue = state.data?.preferences?.[key];
      setRow((r) => ({ ...r, [key]: serverValue ?? r[key] }));
      const detail = (e as Error).message?.replace(/^Error: /, "");
      toast.error("That did not save", { description: detail || undefined });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-start gap-3 border-b px-4 py-4 sm:px-5">
        <span className="mt-0.5 text-muted-foreground">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">Notifications</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Choose how each update reaches you. Everything stays visible in the workspace
            and in Messages either way.
          </p>
        </div>
      </header>

      <div className="px-4 py-4 sm:px-5">
        {state.isError ? (
          <QueryErrorCard error={state.error} onRetry={state.retry} retrying={state.retrying} />
        ) : state.isLoading ? (
          <ul className="divide-y" aria-hidden="true">
            {NOTIFICATION_EVENTS.map((e) => (
              <li key={e.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-44 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted/60" />
                </div>
                <div className="h-9 w-[168px] shrink-0 animate-pulse rounded-md bg-muted/60" />
              </li>
            ))}
          </ul>
        ) : (
          <>
            {usingDefaults && (
              <p className="mb-3 text-xs text-muted-foreground">
                These are the defaults we ship. Change any row and it saves on its own.
              </p>
            )}
            <ul className="divide-y">
              {NOTIFICATION_EVENTS.map((spec) => {
                const locked = !!spec.lockedReason;
                return (
                  <li
                    key={spec.key}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <Label htmlFor={`np-${spec.key}`} className="text-sm font-medium">
                        {spec.label}
                      </Label>
                      <p className="mt-0.5 text-xs text-muted-foreground">{spec.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Default: {modeLabelFor(spec, spec.defaultMode)}
                      </p>
                      {locked && (
                        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>{spec.lockedReason}</span>
                        </p>
                      )}
                    </div>
                    <Select
                      value={row[spec.key]}
                      onValueChange={(v) => commit(spec.key, v as DeliveryMode)}
                      disabled={!canEdit || savingKey === spec.key}
                    >
                      <SelectTrigger
                        id={`np-${spec.key}`}
                        className="w-full shrink-0 sm:w-[186px]"
                        aria-label={`${spec.label} delivery`}
                      >
                        <SelectValue>{modeLabelFor(spec, row[spec.key])}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {spec.modes.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {modeLabelFor(spec, mode)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
              Service notices about your own roles are separate from marketing email —
              unsubscribing from one never changes the other.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export function useNotificationPreferenceSummary(row: PreferenceRow) {
  return useMemo(() => {
    const off = NOTIFICATION_EVENTS.filter((e) => row[e.key] === "off").length;
    const digest = NOTIFICATION_EVENTS.filter((e) => row[e.key] === "daily").length;
    return { off, digest };
  }, [row]);
}
