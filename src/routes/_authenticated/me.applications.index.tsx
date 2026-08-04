import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
 listMyApplications,
 withdrawApplication,
 type CandidateSafeStatus,
} from "@/lib/candidate.functions";
import { Button } from "@/components/ui/button";
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CANDIDATE_STATUS_TONE } from "@/lib/candidate-status";
import { useConfirmAction } from "@/components/ds";


export const Route = createFileRoute("/_authenticated/me/applications/")({
 head: () => ({
 meta: [
 { title: "My applications · TaaSFlow" },
 { name: "robots", content: "noindex" },
 ],
 }),
 loader: ({ context }) =>
 context.queryClient.ensureQueryData({
 queryKey: ["me-applications"],
 queryFn: () => listMyApplications(),
 }),
 pendingComponent: () => (
 <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-4" aria-hidden>
 <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
 <div className="h-32 animate-pulse rounded-lg bg-muted" />
 <div className="h-32 animate-pulse rounded-lg bg-muted" />
 </main>
 ),
 errorComponent: makeRouteErrorComponent("candidate", "src/routes/_authenticated/me.applications.index.tsx"),
 notFoundComponent: () => <main className="p-8">Not found.</main>,
 component: MyApplicationsPage,
});

const STATUS_TONE = CANDIDATE_STATUS_TONE;


function MyApplicationsPage() {
 const data = Route.useLoaderData();
 const listFn = useServerFn(listMyApplications);
 const withdrawFn = useServerFn(withdrawApplication);
 const qc = useQueryClient();
 const { data: current = data } = useQuery({
 queryKey: ["me-applications"],
 queryFn: () => listFn(),
 initialData: data,
 });

 const { confirm, confirmDialog } = useConfirmAction();

 const withdraw = useMutation({
 mutationFn: (id: string) => withdrawFn({ data: { id } }),
 onSuccess: (r) => {
 if (r.ok) {
 toast.success("Application withdrawn.");
 qc.invalidateQueries({ queryKey: ["me-applications"] });
 } else {
 toast.error(r.message);
 }
 },
 onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
 });

 const apps = current.applications;

 return (
 <main className="mx-auto max-w-4xl px-6 py-8">
 <header className="mb-6">
 <h1 className="text-2xl font-semibold">My applications</h1>
 <p className="text-sm text-muted-foreground">
 Track every role you&apos;ve applied to. Withdraw any time before a
 final decision.
 </p>
 </header>

 {apps.length === 0 && (
 <Card>
 <CardHeader>
 <CardTitle>No applications yet</CardTitle>
 <CardDescription>
 Once you apply to a role, it will appear here with real-time status.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Link
 to="/jobs"
 className="inline-flex items-center px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium"
 >
 Browse open roles
 </Link>
 </CardContent>
 </Card>
 )}

 <div className="space-y-3">
 {(apps as Array<{
 id: string;
 role_title: string;
 company: string | null;
 location: string | null;
 employment_type: string | null;
 work_model: string | null;
 applied_at: string;
 last_update: string;
 status: CandidateSafeStatus;
 next_step: string | null;
 can_withdraw: boolean;
 info_requested: boolean;
 next_interview_at: string | null;
 }>).map((a) => (

 <Card key={a.id}>
 <CardHeader className="pb-3">
 <div className="flex items-start justify-between gap-4">
 <div className="min-w-0">
 <CardTitle className="text-base truncate">
 {a.role_title}
 </CardTitle>
 <CardDescription>
 {a.company ?? "Company disclosed after review"}
 {a.location ? ` · ${a.location}` : ""}
 {a.employment_type ? ` · ${a.employment_type}` : ""}
 {a.work_model ? ` · ${a.work_model}` : ""}
 </CardDescription>
 </div>
 <div className="flex shrink-0 flex-col items-end gap-1">
 <Badge className={STATUS_TONE[a.status]} variant="outline">
 {a.status}
 </Badge>
 {a.info_requested ? (
 <span className="text-[10px] uppercase tracking-wide taas-fg-warning">
 Reply needed
 </span>
 ) : null}
 {a.next_interview_at ? (
 <span className="text-[10px] text-muted-foreground">
 {new Date(a.next_interview_at).toLocaleDateString()}
 </span>
 ) : null}
 </div>
 </div>
 </CardHeader>
 <CardContent className="pt-0">

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground mb-3">
 <div>
 <div className="uppercase tracking-wide">Applied</div>
 <div className="text-foreground text-sm">
 {new Date(a.applied_at).toLocaleDateString()}
 </div>
 </div>
 <div>
 <div className="uppercase tracking-wide">Last update</div>
 <div className="text-foreground text-sm">
 {new Date(a.last_update).toLocaleDateString()}
 </div>
 </div>
 <div>
 <div className="uppercase tracking-wide">Next step</div>
 <div className="text-foreground text-sm">
 {a.next_step ?? "—"}
 </div>
 </div>
 </div>
 <div className="flex gap-2">
 <Link
 to="/me/applications/$id"
 params={{ id: a.id }}
 className="inline-flex items-center px-3 py-1.5 rounded border text-sm hover:bg-muted"
 >
 Track application
 </Link>
 {a.can_withdraw && (
 <Button
 variant="ghost"
 size="sm"
 className="min-h-11"
 onClick={async () => {
 const r = await confirm({
 title: "Withdraw application",
 object: `${a.role_title}${a.company ? ` · ${a.company}` : ""}`,
 description:
 "We'll stop reviewing this application and let the hiring team know.",
 impact: [
 "You can't undo this for the same role",
 "Your profile stays with us for other roles",
 ],
 confirmLabel: "Withdraw application",
 tone: "destructive",
 });
 if (r.confirmed) withdraw.mutate(a.id);
 }}
 disabled={withdraw.isPending}
 aria-busy={withdraw.isPending || undefined}
 >
 {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 {confirmDialog}
 </main>
 );
}
