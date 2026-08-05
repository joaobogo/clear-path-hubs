import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listMyCvVersions,
  listMyCvApplications,
  applyCvToApplications,
  getMyCvDownloadUrl,
  replaceMyCv,
} from "@/lib/candidate.functions";
import { CV_SCOPE_COPY, type CvScopeReason } from "@/lib/candidate/cv-scope";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { Download, FileText, Lock, Upload } from "lucide-react";

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

const MAX_CV_BYTES = 10 * 1024 * 1024;

function fmtSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

type ScopeApp = {
  id: string;
  role_title: string;
  company: string | null;
  applied_at: string | null;
  cv_file_id: string | null;
  cv_filename: string | null;
  scope_reason: CvScopeReason;
  can_replace: boolean;
};

function CvPage() {
  const init = Route.useLoaderData();
  const qc = useQueryClient();
  const listFn = useServerFn(listMyCvVersions);
  const scopeFn = useServerFn(listMyCvApplications);
  const dlFn = useServerFn(getMyCvDownloadUrl);
  const upFn = useServerFn(replaceMyCv);
  const applyFn = useServerFn(applyCvToApplications);

  const [selected, setSelected] = useState<string[]>([]);

  const { data = init } = useQuery({
    queryKey: ["me", "cv"],
    queryFn: () => listFn(),
    initialData: init,
  });

  const scopeQuery = useQuery({
    queryKey: ["me", "cv", "applications"],
    queryFn: () => scopeFn(),
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

  const applyScope = useMutation({
    mutationFn: (vars: { file_id: string; application_ids: string[] }) =>
      applyFn({ data: vars }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      const names = r.updated.map((u) => u.role_title).join(", ");
      toast.success(
        `${r.filename} is now the CV on ${r.updated.length} application${
          r.updated.length === 1 ? "" : "s"
        }: ${names}.${r.skipped.length > 0 ? " Closed and offer-stage applications were left untouched." : ""}`,
      );
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["me", "cv"] });
      qc.invalidateQueries({ queryKey: ["me-applications"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.replace(/^Error: /, "") ||
          "We couldn't update your applications. Your previous CV is still in use.",
      ),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      new Promise<{ ok: boolean; message?: string }>((resolve, reject) => {
        const r = new FileReader();
        r.onerror = () => reject(new Error("We couldn't read that file. Please try again."));
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
        toast.success(
          "CV uploaded. Choose which open applications should use it below — nothing changed automatically.",
        );
        qc.invalidateQueries({ queryKey: ["me", "cv"] });
        qc.invalidateQueries({ queryKey: ["me-context"] });
      } else {
        toast.error(
          r.message ?? "Upload failed — your previous CV is still in use on your applications.",
        );
      }
    },
    onError: (e: Error) =>
      toast.error(
        e.message.replace(/^Error: /, "") ||
          "Upload failed — your previous CV is still in use on your applications.",
      ),
  });

  const versions = (data.versions ?? []) as Array<{
    id: string;
    filename: string;
    size: number | null;
    created_at: string;
  }>;
  const currentId = data.current_id;
  const currentCv = versions.find((v) => v.id === currentId) ?? null;

  const apps = (scopeQuery.data?.applications ?? []) as ScopeApp[];
  const usingCurrent = apps.filter((a) => a.cv_file_id && a.cv_file_id === currentId);
  const replaceable = apps.filter((a) => a.can_replace);
  const locked = apps.filter((a) => !a.can_replace);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Your CV</h1>
        <p className="text-sm text-muted-foreground">
          Fixed something on your CV? Upload the new file and pick which open applications should
          use it. You never need to apply twice.
        </p>
      </header>

      {/* Current CV */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" /> Current CV
        </h2>
        {currentCv ? (
          <div className="mt-3 space-y-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{currentCv.filename}</div>
              <div className="text-xs text-muted-foreground">
                {fmtSize(currentCv.size)} · uploaded{" "}
                {new Date(currentCv.created_at).toLocaleDateString()} (
                {formatDistanceToNow(new Date(currentCv.created_at), { addSuffix: true })})
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full min-h-11 sm:w-auto"
              disabled={download.isPending}
              onClick={() => download.mutate(currentCv.id)}
              aria-label={`Download ${currentCv.filename}`}
            >
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
            {scopeQuery.isPending ? (
              <div className="h-4 w-56 animate-pulse rounded bg-muted" aria-hidden />
            ) : scopeQuery.isError ? null : (
              <p className="text-xs text-muted-foreground">
                {usingCurrent.length === 0
                  ? "No applications are using this file yet."
                  : `Used by ${usingCurrent.length} application${
                      usingCurrent.length === 1 ? "" : "s"
                    }: ${usingCurrent.map((a) => a.role_title).join(", ")}.`}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No CV on file. Upload one below — it becomes your current CV.
          </p>
        )}
      </section>

      {/* Upload */}
      <section className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Upload className="h-4 w-4" /> Upload a replacement
        </h2>
        <p className="text-xs text-muted-foreground">
          PDF only, up to 10 MB. Uploading does not change any application on its own — you choose
          which ones below.
        </p>
        <label htmlFor="cv-upload" className="sr-only">
          Choose a PDF CV to upload
        </label>
        <input
          id="cv-upload"
          type="file"
          accept="application/pdf,.pdf"
          className="w-full min-h-11 text-sm"
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
            if (f.size > MAX_CV_BYTES) {
              toast.error("That file is over 10 MB. Please upload a smaller PDF.");
              e.target.value = "";
              return;
            }
            upload.mutate(f);
          }}
          disabled={upload.isPending}
        />
        {upload.isPending && <div className="text-xs text-muted-foreground">Uploading…</div>}
      </section>

      {/* Per-application scope */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" /> Applications using your CV
        </h2>

        {scopeQuery.isPending ? (
          <div className="mt-3 space-y-2" aria-hidden>
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
          </div>
        ) : scopeQuery.isError ? (
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t load your applications just now. Your current CV is still in use on
            them — nothing has changed.
          </p>
        ) : apps.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            You haven&apos;t applied to any roles yet, so there is nothing to update.
          </p>
        ) : (
          <>
            {replaceable.length > 0 && currentCv ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select the applications that should use{" "}
                  <span className="text-foreground font-medium">{currentCv.filename}</span>.
                </p>
                <ul className="mt-3 space-y-2">
                  {replaceable.map((a) => {
                    const checked = selected.includes(a.id);
                    const already = a.cv_file_id === currentId;
                    return (
                      <li key={a.id}>
                        <label
                          htmlFor={`cv-app-${a.id}`}
                          className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-lg border p-3 min-h-11 cursor-pointer transition-colors hover:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-primary/40"
                        >
                          <Checkbox
                            id={`cv-app-${a.id}`}
                            className="mt-0.5"
                            checked={checked}
                            onCheckedChange={() => toggle(a.id)}
                            aria-label={`Use current CV for ${a.role_title}${
                              a.company ? ` at ${a.company}` : ""
                            }`}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{a.role_title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {a.company ?? "Company disclosed after review"}
                              {a.applied_at
                                ? ` · applied ${new Date(a.applied_at).toLocaleDateString()}`
                                : ""}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {already
                                ? "Already using your current CV"
                                : `Currently: ${a.cv_filename ?? "no CV attached"}`}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="sticky bottom-4 mt-4">
                  <Button
                    className="w-full min-h-11"
                    disabled={selected.length === 0 || applyScope.isPending}
                    onClick={() =>
                      currentCv &&
                      applyScope.mutate({ file_id: currentCv.id, application_ids: selected })
                    }
                  >
                    {applyScope.isPending
                      ? "Updating…"
                      : selected.length === 0
                        ? "Select applications to update"
                        : `Use this CV on ${selected.length} application${
                            selected.length === 1 ? "" : "s"
                          }`}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {currentCv
                  ? "None of your applications can take a new CV right now."
                  : "Upload a CV above before choosing which applications use it."}
              </p>
            )}

            {locked.length > 0 ? (
              <div className="mt-5 border-t pt-4">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Cannot be changed
                </h3>
                <ul className="mt-2 space-y-2">
                  {locked.map((a) => (
                    <li key={a.id} className="rounded-lg border bg-muted/30 p-3">
                      <span className="block text-sm font-medium">{a.role_title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {CV_SCOPE_COPY[a.scope_reason as "offer_stage" | "closed"]}
                      </span>
                      {a.cv_filename ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Submitted with {a.cv_filename}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* History */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" /> CV history
        </h2>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No CV on file. Upload one above to get started.
          </p>
        ) : (
          <ul className="divide-y">
            {versions.map((v) => {
              const isCurrent = v.id === currentId;
              return (
                <li key={v.id} className="py-3 space-y-2">
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
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full min-h-11 sm:w-auto"
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
        <p className="mt-3 text-xs text-muted-foreground">
          We keep every version. Nothing a hiring team has already reviewed is ever deleted.
        </p>
      </section>
    </main>
  );
}
