import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  getMyContext,
  updateMyConsent,
  requestCorrection,
  requestAccountDeletion,
} from "@/lib/candidate.functions";
import { requestMyDataExport } from "@/lib/candidate/support.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmAction } from "@/components/ds";
import { AvailabilityBlock } from "@/components/candidate/availability-block";
import { SupportRequestSheet } from "@/components/candidate/support-request-sheet";
import {
  CANDIDATE_NOTIFICATION_EVENTS,
  resolveNotificationPrefs,
} from "@/lib/candidate/notification-events";
import { track } from "@/lib/candidate/funnel-events.functions";

export const Route = createFileRoute("/_authenticated/me/settings")({
  head: () => ({
    meta: [
      { title: "Privacy & settings · TaaSFlow" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["me-context"],
      queryFn: () => getMyContext(),
    }),
  errorComponent: makeRouteErrorComponent("candidate", "src/routes/_authenticated/me.settings.tsx"),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
  component: SettingsPage,
});

function SettingsPage() {
  const init = Route.useLoaderData();
  const ctxFn = useServerFn(getMyContext);
  const consentFn = useServerFn(updateMyConsent);
  const corrFn = useServerFn(requestCorrection);
  const delFn = useServerFn(requestAccountDeletion);
  const exportFn = useServerFn(requestMyDataExport);
  const qc = useQueryClient();
  const { data = init } = useQuery({
    queryKey: ["me-context"],
    queryFn: () => ctxFn(),
    initialData: init,
  });

  const consent = (data?.profile?.consent ?? {}) as Record<string, boolean | string>;
  const [networkOptIn, setNetworkOptIn] = useState<boolean>(!!consent.network_opt_in);
  const [smsNotif, setSmsNotif] = useState<boolean>(!!consent.notifications_sms);
  const [events, setEvents] = useState<Record<string, boolean>>(() =>
    resolveNotificationPrefs(consent),
  );
  const [correction, setCorrection] = useState("");
  const { confirm, confirmDialog } = useConfirmAction();
  const [deleteReason, setDeleteReason] = useState("");

  useEffect(() => {
    setNetworkOptIn(!!consent.network_opt_in);
    setSmsNotif(!!consent.notifications_sms);
    setEvents(resolveNotificationPrefs(consent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(consent)]);

  const saveConsent = useMutation({
    mutationFn: () =>
      consentFn({
        data: {
          network_opt_in: networkOptIn,
          notifications_sms: smsNotif,
          marketing_opt_in: events.product_updates === true,
          notification_events: events,
        },
      }),
    onSuccess: (r) => {
      if (r.ok) {
        track("notification_prefs_saved");
        toast.success("Preferences saved.");
        qc.invalidateQueries({ queryKey: ["me-context"] });
      } else toastError(r);
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't save consent. Nothing was saved — please try again." }),
  });

  const submitCorrection = useMutation({
    mutationFn: (note: string) => corrFn({ data: { note } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Correction request sent. We'll follow up over messages.");
        setCorrection("");
      } else toast.error(r.message ?? "Failed");
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't submit correction. Nothing was saved — please try again." }),
  });

  const requestExport = useMutation({
    mutationFn: () => exportFn({ data: {} }),
    onSuccess: (r) => {
      if (r.ok) {
        track("data_export_requested");
        toast.success("Export requested. We'll email your copy within 30 days.");
      } else toast.error(r.message ?? "We could not send that request.");
    },
    onError: () => toast.error("We could not send that request."),
  });

  const requestDelete = useMutation({
    mutationFn: (reason: string) => delFn({ data: { reason } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success("Deletion request received. Our team will confirm by email.");
        setDeleteReason("");
      } else toast.error("Failed");
    },
  
    // Failure must be visible: a silent rejection reads as success.
    onError: (e: unknown) =>
      toastError(e, { fallback: "We couldn't request delete. Nothing was saved — please try again." }),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Privacy &amp; settings</h1>
          <p className="text-sm text-muted-foreground">
            Control how your data is used and how we reach you.
          </p>
        </div>
        <SupportRequestSheet />
      </header>

      {data?.seat === "candidate" && (
        <>
          <section className="rounded-lg border bg-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-medium">What we email you about</h2>
              <p className="text-xs text-muted-foreground">
                Turn off anything you don&apos;t want. Three kinds of message stay on because
                they are the ones you have to act on — we won&apos;t silently drop those.
              </p>
            </div>

            <ul className="divide-y">
              {CANDIDATE_NOTIFICATION_EVENTS.map((event) => (
                <li key={event.key} className="flex items-start justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <Label className="text-sm">{event.label}</Label>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                    {event.required ? (
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        Always on
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    checked={event.required ? true : events[event.key] === true}
                    disabled={event.required}
                    aria-label={event.label}
                    onCheckedChange={(v) =>
                      setEvents((prev) => ({ ...prev, [event.key]: v === true }))
                    }
                  />
                </li>
              ))}
            </ul>

            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <div>
                <Label className="text-sm">Also send time-sensitive updates by SMS</Label>
                <p className="text-xs text-muted-foreground">
                  Interview times and anything with a deadline. Nothing else.
                </p>
              </div>
              <Switch checked={smsNotif} onCheckedChange={setSmsNotif} aria-label="SMS updates" />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm">Include me in the TaaSFlow talent network</Label>
                <p className="text-xs text-muted-foreground">
                  Let us consider you for roles beyond the ones you applied to.
                </p>
              </div>
              <Switch
                checked={networkOptIn}
                onCheckedChange={setNetworkOptIn}
                aria-label="Talent network"
              />
            </div>

            <Button
              className="min-h-11"
              onClick={() => saveConsent.mutate()}
              disabled={saveConsent.isPending}
              aria-busy={saveConsent.isPending || undefined}
            >
              {saveConsent.isPending ? "Saving…" : "Save preferences"}
            </Button>
          </section>

          <AvailabilityBlock
            availability={data?.profile?.availability ?? null}
            profileTimezone={data?.profile?.timezone ?? null}
            onSaved={() => qc.invalidateQueries({ queryKey: ["me-context"] })}
          />

          <section className="rounded-lg border bg-card p-5 space-y-3">
            <h2 className="text-sm font-medium">Request a correction</h2>
            <p className="text-xs text-muted-foreground">
              Something wrong in your profile or application? Tell us what to fix.
            </p>
            <Textarea
              rows={4}
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              placeholder="Please update my location to…"
            />
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!correction.trim() || submitCorrection.isPending}
              onClick={() => submitCorrection.mutate(correction.trim())}
            >
              Send request
            </Button>
          </section>
        </>
      )}

      <section className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-sm font-medium">Get a copy of your data</h2>
        <p className="text-xs text-muted-foreground">
          We&apos;ll email you everything we hold: your profile, your consent record
          {data?.seat === "candidate" && ", and your applications and CV"}.
          We action export requests within 30 days — we won&apos;t
          promise an instant download we can&apos;t honour.
        </p>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={requestExport.isPending}
          aria-busy={requestExport.isPending || undefined}
          onClick={() => requestExport.mutate()}
        >
          {requestExport.isPending ? "Requesting…" : "Request my data"}
        </Button>
      </section>

      <section className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-sm font-medium text-destructive">Delete my account</h2>
        <p className="text-xs text-muted-foreground">
          We&apos;ll confirm by email before removing your data.
          {data?.seat === "candidate" && " Withdrawn applications are retained only as required for record-keeping."}
        </p>
        <Textarea
          rows={3}
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          placeholder="Optional: tell us why."
        />
        <Button
          variant="destructive"
          className="min-h-11"
          disabled={requestDelete.isPending}
          aria-busy={requestDelete.isPending || undefined}
          onClick={async () => {
            const r = await confirm({
              title: "Request account deletion",
              description:
                "We'll email you to confirm before anything is removed.",
              impact: [
                ...(data?.seat === "candidate" ? ["Open applications are withdrawn", "Your CV and profile are deleted once confirmed"] : ["Your profile and account details are deleted once confirmed"]),
                "Records we must keep by law are retained, minimised",
              ],
              typedConfirmation: "DELETE",
              confirmLabel: "Request deletion",
              tone: "destructive",
            });
            if (r.confirmed) requestDelete.mutate(deleteReason.trim());
          }}
        >
          {requestDelete.isPending ? "Sending…" : "Request deletion"}
        </Button>
      </section>
      {confirmDialog}
    </div>
  );
}
