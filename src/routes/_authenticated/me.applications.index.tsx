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
 errorComponent: ({ error }) => (
 <main className="p-8 text-destructive">Failed to load: {error.message}</main>
 ),
 notFoundComponent: () => <main className="p-8">Not found.</main>,
 component: MyApplicationsPage,
});

const STATUS_TONE: Record<CandidateSafeStatus, string> = {
 "Application received": "bg-secondary text-secondary-foreground",
 "Information being reviewed": "bg-secondary text-secondary-foreground",
 "Additional information requested": "taas-bg-warning-soft taas-fg-warning ",
 "Under consideration": "taas-bg-info-soft taas-fg-info ",
 Shortlisted: "taas-bg-info-soft taas-fg-info ",
 "Interview requested": "taas-bg-info-soft taas-fg-info ",
 "Decision pending": "bg-primary/15 text-primary",
 Hired: "taas-bg-success-soft taas-fg-success ",
 "Not selected for this role": "bg-muted text-muted-foreground",
 "Role closed": "bg-muted text-muted-foreground",
 Withdrawn: "bg-muted text-muted-foreground",
};

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
 <Badge className={STATUS_TONE[a.status]} variant="outline">
 {a.status}
 </Badge>
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
 onClick={() => {
 if (confirm("Withdraw this application?")) {
 withdraw.mutate(a.id);
 }
 }}
 disabled={withdraw.isPending}
 >
 Withdraw
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </main>
 );
}
