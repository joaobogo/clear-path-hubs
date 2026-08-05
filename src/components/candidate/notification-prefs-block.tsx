import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Lock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CANDIDATE_PREF_EVENTS,
  SMS_UNAVAILABLE_REASON,
  modeLabel,
  rowStateLine,
  supportsSms,
  type CandidateDeliveryMode,
  type CandidatePrefKey,
} from "@/lib/candidate/notification-prefs";
import {
  getMyNotificationPreferences,
  updateMyNotificationPreference,
} from "@/lib/candidate/notification-prefs.functions";

/**
 * Per-event notification preferences.
 *
 * Each row saves on its own and confirms on its own. A failed save puts the row
 * back to the value the server still holds and says so, so the control never
 * shows a preference that was not stored. Deadline-bearing notices offer digest
 * but not off, and say why. SMS is only offerable with a verified number.
 */
export function NotificationPrefsBlock() {
  const load = useServerFn(getMyNotificationPreferences);
  const save = useServerFn(updateMyNotificationPreference);
  const qc = useQueryClient();
  const [savingRow, setSavingRow] = useState<CandidatePrefKey | null>(null);
  const [savedRow, setSavedRow] = useState<CandidatePrefKey | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["me-notification-prefs"],
    queryFn: () => load(),
  });

  const mut = useMutation({
    mutationFn: (vars: { key: CandidatePrefKey; mode?: CandidateDeliveryMode; sms?: boolean }) =>
      save({ data: vars }),
    onSuccess: (_r, vars) => {
      setSavedRow(vars.key);
      window.setTimeout(() => setSavedRow((k) => (k === vars.key ? null : k)), 2500);
      qc.invalidateQueries({ queryKey: ["me-notification-prefs"] });
    },
    onError: (e: unknown) => {
      // Nothing local is kept, so the row re-renders from the server value —
      // it visibly reverts rather than showing an unsaved choice.
      qc.invalidateQueries({ queryKey: ["me-notification-prefs"] });
      toast.error(e instanceof Error && e.message ? e.message : "That did not save.");
    },
    onSettled: () => setSavingRow(null),
  });

  if (isLoading) {
    return (
      <section className="rounded-lg border bg-card p-5" aria-busy="true">
        <h2 className="text-sm font-medium">Notifications</h2>
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-14 w-full animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-medium">Notifications</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t load your notification settings. Nothing has changed — please try again.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-medium">Notifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose these one at a time. Everything still appears in your portal, whatever you pick
          here.
        </p>
      </div>

      <ul className="divide-y">
        {CANDIDATE_PREF_EVENTS.map((spec) => {
          const mode = data.prefs[spec.key];
          const sms = data.sms[spec.key];
          const busy = savingRow === spec.key && mut.isPending;
          const smsAllowed = supportsSms(spec.key) && data.smsAvailable;

          return (
            <li key={spec.key} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {spec.label}
                    {spec.optionalNetworkMail ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Optional
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{spec.description}</p>
                  <p className="mt-1 text-xs font-medium">
                    {busy ? "Saving…" : rowStateLine(spec.key, mode, sms)}
                    {savedRow === spec.key && !busy ? (
                      <span className="ml-2 font-normal text-muted-foreground">Saved</span>
                    ) : null}
                  </p>
                </div>

                <div className="w-full sm:w-48">
                  <label className="sr-only" htmlFor={`mode-${spec.key}`}>
                    Email delivery for {spec.label}
                  </label>
                  <Select
                    value={mode}
                    disabled={busy}
                    onValueChange={(v) => {
                      setSavingRow(spec.key);
                      mut.mutate({ key: spec.key, mode: v as CandidateDeliveryMode });
                    }}
                  >
                    <SelectTrigger id={`mode-${spec.key}`} className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {spec.modes.map((m) => (
                        <SelectItem key={m} value={m}>
                          {modeLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {spec.lockedReason ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {spec.lockedReason}
                </p>
              ) : null}

              {spec.optionalNetworkMail ? (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Turning this off never affects interview or document notices.
                </p>
              ) : null}

              {supportsSms(spec.key) ? (
                <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border bg-background/60 p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <MessageSquare className="h-3.5 w-3.5" /> Also text me
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {data.smsAvailable
                        ? sms
                          ? "SMS on for this notice."
                          : "SMS off for this notice."
                        : SMS_UNAVAILABLE_REASON}
                    </p>
                  </div>
                  <Switch
                    checked={sms}
                    disabled={!smsAllowed || busy}
                    aria-label={`Text me about ${spec.label}`}
                    onCheckedChange={(v) => {
                      setSavingRow(spec.key);
                      mut.mutate({ key: spec.key, sms: v });
                    }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
