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
  errorComponent: ({ error }) => (
    <main className="p-8 text-destructive">Failed to load: {error.message}</main>
  ),
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
      if (r.ok) {
        window.open(r.url, "_blank", "noopener,noreferrer");
      } else toast.error(r.message);
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      new Promise<{ ok: boolean; message?: string }>((resolve) => {
        const r = new FileReader();
        r.onload = async () => {
          const base64 = String(r.result).split(",")[1] ?? "";
          const res = await upFn({
            data: {
              filename: file.name,
              mime: file.type || "application/pdf",
              base64,
            },
          });
          resolve(res);
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
  });

  const versions = data.versions ?? [];
  const currentId = data.current_id;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Your CV</h1>
        <p className="text-sm text-muted-foreground">
          Upload a new CV any time. We keep previous versions so nothing is lost;
          your active applications always reference your current CV.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" /> Upload new CV
        </h2>
        <p className="text-xs text-muted-foreground">
          PDF or DOCX, up to 10 MB. Uploading a new file replaces your current
          CV on new submissions; older versions stay available below.
        </p>
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
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
            {(versions as Array<{ id: string; filename: string; size: number | null; created_at: string }>).map((v) => {
              const isCurrent = v.id === currentId;
              return (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 py-3"
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
                    disabled={download.isPending}
                    onClick={() => download.mutate(v.id)}
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
