import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
 listMyCvVersions,
 getMyCvDownloadUrl,
 replaceMyCv,
} from "@/lib/candidate.functions";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Download, FileText, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/me/cv")({
 head: () => ({
 meta: [
 { title: "My CV · TaaSFlow" },
 { name: "robots", content: "noindex" },
 ],
 }),
 loader: ({ context }) =>
 context.queryClient.ensureQueryData({
 queryKey: ["me", "cv"],
 queryFn: () => listMyCvVersions(),
 }),
 pendingComponent: () => (
 <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-4" aria-hidden>
 <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
 <div className="h-28 animate-pulse rounded-lg bg-muted" />
 <div className="h-40 animate-pulse rounded-lg bg-muted" />
 </main>
 ),
 errorComponent: makeRouteErrorComponent("candidate", "src/routes/_authenticated/me.cv.tsx"),
 notFoundComponent: () => <main className="p-8">Not found.</main>,
 component: CvPage,
});

function fmtSize(bytes: number | null | undefined): string {
 if (!bytes) return "—";
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function CvPage() {
 const init = Route.useLoaderData();
 const qc = useQueryClient();
 const listFn = useServerFn(listMyCvVersions);
 const dlFn = useServerFn(getMyCvDownloadUrl);
 const upFn = useServerFn(replaceMyCv);

 const { data = init } = useQuery({
 queryKey: ["me", "cv"],
 queryFn: () => listFn(),
 initialData: init,
 });

 const download = useMutation({
 mutationFn: (file_id: string) => dlFn({ data: { file_id } }),
 onSuccess: (r) => {
 if (r.ok && r.url) {
 window.open(r.url, "_blank", "noopener,noreferrer");
 } else {
 toast.error(
 (r.ok ? undefined : r.message) ??
 "That download link isn't available right now. Please try again.",
 );
 }
 },
 onError: (e: Error) => toast.error(e.message.replace(/^Error: /, "")),
 });

 const upload = useMutation({
 mutationFn: (file: File) =>
 new Promise<{ ok: boolean; message?: string }>((resolve, reject) => {
 const r = new FileReader();
 r.onerror = () =>
 reject(new Error("We couldn't read that file. Please try again."));
 r.onload = () => {
 const base64 = String(r.result).split(",")[1] ?? "";
 upFn({
 data: {
 filename: file.name,
 mime: file.type || "application/pdf",
 base64,
 },
 })
 .then(resolve)
 .catch(reject);
 };
 r.readAsDataURL(file);
 }),
 onSuccess: (r) => {
 if (r.ok) {
 toast.success("CV uploaded. We'll re-process your applications.");
 qc.invalidateQueries({ queryKey: ["me", "cv"] });
 qc.invalidateQueries({ queryKey: ["me-context"] });
 } else toast.error(r.message ?? "Upload failed");
 },
 onError: (e: Error) =>
 toast.error(e.message.replace(/^Error: /, "") || "Upload failed"),
 });

 const versions = (data.versions ?? []) as Array<{
 id: string;
 filename: string;
 size: number | null;
 created_at: string;
 }>;
 const currentId = data.current_id;
 const currentCv = versions.find((v) => v.id === currentId) ?? null;

 return (
 <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">

 <header>
 <h1 className="text-2xl font-semibold">Your CV</h1>
 <p className="text-sm text-muted-foreground">
 Upload a new CV any time. We keep previous versions so nothing is lost;
 your active applications always reference your current CV.
 </p>
 </header>

 <section className="rounded-lg border bg-card p-5">
 <h2 className="text-sm font-medium flex items-center gap-2">
 <FileText className="h-4 w-4" /> Current CV
 </h2>
 {currentCv ? (
 <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
 <div className="min-w-0">
 <div className="truncate font-medium">{currentCv.filename}</div>
 <div className="text-xs text-muted-foreground">
 {fmtSize(currentCv.size)} · added{" "}
 {formatDistanceToNow(new Date(currentCv.created_at), { addSuffix: true })}
 </div>
 </div>
 <Button
 variant="outline"
 size="sm"
 className="min-h-11"
 disabled={download.isPending}
 onClick={() => download.mutate(currentCv.id)}
 >
 <Download className="h-4 w-4 mr-1" /> Download
 </Button>
 </div>
 ) : (
 <p className="mt-2 text-sm text-muted-foreground">
 No CV on file yet. Upload one below and it becomes your current CV.
 </p>
 )}
 </section>

 <section className="rounded-lg border bg-card p-5 space-y-3">
 <h2 className="text-sm font-medium flex items-center gap-2">
 <Upload className="h-4 w-4" /> Upload new CV
 </h2>
 <p className="text-xs text-muted-foreground">
 PDF only, up to 10 MB. A new file becomes your current CV for future
 submissions. Applications you already sent keep the CV they were sent
 with, so your history stays intact.
 </p>
 <label htmlFor="cv-upload" className="sr-only">
 Choose a PDF CV to upload
 </label>
 <input
 id="cv-upload"
 type="file"
 accept="application/pdf,.pdf"
 className="min-h-11 text-sm"
 onChange={(e) => {
 const f = e.target.files?.[0];
 if (!f) return;
 const isPdf =
 f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
 if (!isPdf) {
 toast.error("Please upload a PDF. Other formats aren't accepted.");
 e.target.value = "";
 return;
 }
 if (f.size > 10 * 1024 * 1024) {
 toast.error("That file is over 10 MB. Please upload a smaller PDF.");
 e.target.value = "";
 return;
 }
 upload.mutate(f);
 }}
 disabled={upload.isPending}
 />
 {upload.isPending && (
 <div className="text-xs text-muted-foreground">Uploading…</div>
 )}
 </section>


 <section className="rounded-lg border bg-card p-5">
 <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
 <FileText className="h-4 w-4" /> CV history
 </h2>
 {versions.length === 0 ? (
 <p className="text-sm text-muted-foreground">
 No CV on file yet. Upload one above to get started.
 </p>
 ) : (
 <ul className="divide-y">
 {versions.map((v) => {
 const isCurrent = v.id === currentId;
 return (
 <li
 key={v.id}
 className="flex flex-wrap items-center justify-between gap-3 py-3"
 >
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium truncate">{v.filename}</span>
 {isCurrent && (
 <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
 Current
 </span>
 )}
 </div>
 <div className="text-xs text-muted-foreground">
 {fmtSize(v.size)} ·{" "}
 {formatDistanceToNow(new Date(v.created_at), {
 addSuffix: true,
 })}
 </div>
 </div>
 <Button
 variant="outline"
 size="sm"
 className="min-h-11"
 disabled={download.isPending}
 onClick={() => download.mutate(v.id)}
 aria-label={`Download ${v.filename}`}
 >
 <Download className="h-4 w-4 mr-1" /> Download
 </Button>

 </li>
 );
 })}
 </ul>
 )}
 </section>
 </main>
 );
}
