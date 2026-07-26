import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
 getMyContext,
 updateMyConsent,
 requestCorrection,
 requestAccountDeletion,
} from "@/lib/candidate.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmAction } from "@/components/ds";

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
 notFoundComponent: () => <main className="p-8">Not found.</main>,
 component: SettingsPage,
});

function SettingsPage() {
 const init = Route.useLoaderData();
 const ctxFn = useServerFn(getMyContext);
 const consentFn = useServerFn(updateMyConsent);
 const corrFn = useServerFn(requestCorrection);
 const delFn = useServerFn(requestAccountDeletion);
 const qc = useQueryClient();
 const { data = init } = useQuery({
 queryKey: ["me-context"],
 queryFn: () => ctxFn(),
 initialData: init,
 });

 const consent = (data?.profile?.consent ?? {}) as Record<string, boolean | string>;
 const [networkOptIn, setNetworkOptIn] = useState<boolean>(!!consent.network_opt_in);
 const [emailNotif, setEmailNotif] = useState<boolean>(consent.notifications_email !== false);
 const [smsNotif, setSmsNotif] = useState<boolean>(!!consent.notifications_sms);
 const [marketing, setMarketing] = useState<boolean>(!!consent.marketing_opt_in);
 const [correction, setCorrection] = useState("");
 const { confirm, confirmDialog } = useConfirmAction();
 const [deleteReason, setDeleteReason] = useState("");

 useEffect(() => {
 setNetworkOptIn(!!consent.network_opt_in);
 setEmailNotif(consent.notifications_email !== false);
 setSmsNotif(!!consent.notifications_sms);
 setMarketing(!!consent.marketing_opt_in);
 }, [
 consent.network_opt_in,
 consent.notifications_email,
 consent.notifications_sms,
 consent.marketing_opt_in,
 ]);

 const saveConsent = useMutation({
 mutationFn: () =>
 consentFn({
 data: {
 network_opt_in: networkOptIn,
 notifications_email: emailNotif,
 notifications_sms: smsNotif,
 marketing_opt_in: marketing,
 },
 }),
 onSuccess: (r) => {
 if (r.ok) {
 toast.success("Preferences saved.");
 qc.invalidateQueries({ queryKey: ["me-context"] });
 } else toast.error(r.message);
 },
 });

 const submitCorrection = useMutation({
 mutationFn: (note: string) => corrFn({ data: { note } }),
 onSuccess: (r) => {
 if (r.ok) {
 toast.success("Correction request sent. We'll follow up over messages.");
 setCorrection("");
 } else toast.error(r.message ?? "Failed");
 },
 });

 const requestDelete = useMutation({
 mutationFn: (reason: string) => delFn({ data: { reason } }),
 onSuccess: (r) => {
 if (r.ok) {
 toast.success("Deletion request received. Our team will confirm by email.");
 setDeleteReason("");
 } else toast.error("Failed");
 },
 });

 return (
 <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
 <header>
 <h1 className="text-2xl font-semibold">Privacy & settings</h1>
 <p className="text-sm text-muted-foreground">
 Control how your data is used and how we reach you.
 </p>
 </header>

 <section className="rounded-lg border bg-card p-5 space-y-4">
 <h2 className="text-sm font-medium">Consent & network</h2>
 <div className="flex items-start justify-between gap-4">
 <div>
 <Label className="text-sm">Include me in the TaaSFlow talent network</Label>
 <p className="text-xs text-muted-foreground">
 Let us proactively match you to other roles beyond the ones you applied to.
 </p>
 </div>
 <Switch checked={networkOptIn} onCheckedChange={setNetworkOptIn} />
 </div>
 <div className="flex items-start justify-between gap-4">
 <div>
 <Label className="text-sm">Email notifications</Label>
 <p className="text-xs text-muted-foreground">
 Application updates, interview requests, messages.
 </p>
 </div>
 <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
 </div>
 <div className="flex items-start justify-between gap-4">
 <div>
 <Label className="text-sm">SMS notifications</Label>
 <p className="text-xs text-muted-foreground">
 Time-sensitive updates only.
 </p>
 </div>
 <Switch checked={smsNotif} onCheckedChange={setSmsNotif} />
 </div>
 <div className="flex items-start justify-between gap-4">
 <div>
 <Label className="text-sm">Occasional product updates</Label>
 <p className="text-xs text-muted-foreground">
 We&apos;ll email you a few times a year, never more.
 </p>
 </div>
 <Switch checked={marketing} onCheckedChange={setMarketing} />
 </div>
 <Button
 onClick={() => saveConsent.mutate()}
 disabled={saveConsent.isPending}
 >
 Save preferences
 </Button>
 </section>

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
 disabled={!correction.trim() || submitCorrection.isPending}
 onClick={() => submitCorrection.mutate(correction.trim())}
 >
 Send request
 </Button>
 </section>

 <section className="rounded-lg border bg-card p-5 space-y-3">
 <h2 className="text-sm font-medium text-destructive">Delete my account</h2>
 <p className="text-xs text-muted-foreground">
 We&apos;ll confirm by email before removing your data. Withdrawn applications
 are retained only as required for record-keeping.
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
 "Open applications are withdrawn",
 "Your CV and profile are deleted once confirmed",
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
 </main>
 );
}
