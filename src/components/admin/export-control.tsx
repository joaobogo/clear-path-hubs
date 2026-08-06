/**
 * Single export control for admin list screens.
 *
 * The dialog requests a server-side export (which always writes an audit row)
 * and lists past exports with their real job id, scope, row count and whether
 * contact details were included. No CSV is ever built in the browser.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileDown, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getExportDownloadUrl,
  listMyExports,
  requestCandidateExport,
  retryExport,
} from "@/lib/exports.functions";

export type ExportScope = {
  organization_id?: string;
  position_id?: string;
  stage?: string;
  client_visibility?: string;
  recommendation?: string;
  score_band?: string;
  date_from?: string;
  date_to?: string;
};

const STATUS_TONE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function ExportControl({ scope }: { scope: ExportScope }) {
  const [open, setOpen] = useState(false);
  const [includeContact, setIncludeContact] = useState(false);
  // Masking is the default whenever contact details are included at all.
  const [maskContacts, setMaskContacts] = useState(true);
  const qc = useQueryClient();

  const requestFn = useServerFn(requestCandidateExport);
  const listFn = useServerFn(listMyExports);
  const retryFn = useServerFn(retryExport);
  const downloadFn = useServerFn(getExportDownloadUrl);

  const scoped = Boolean(scope.position_id || scope.organization_id);

  const history = useQuery({
    queryKey: ["my-exports"],
    queryFn: () => listFn(),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  const request = useMutation({
    mutationFn: () =>
      requestFn({
        data: { ...scope, include_contact: includeContact, mask_contacts: maskContacts },
      }),
    onSuccess: (res) => {
      toast.success(`Export requested — job ${res.job_id.slice(0, 8)}`);
      void qc.invalidateQueries({ queryKey: ["my-exports"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not request the export."),
  });

  const retry = useMutation({
    mutationFn: (jobId: string) => retryFn({ data: { job_id: jobId } }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["my-exports"] }),
    onError: (e: Error) => toast.error(e.message || "Retry failed."),
  });

  const download = useMutation({
    mutationFn: (jobId: string) => downloadFn({ data: { job_id: jobId } }),
    onSuccess: (res) => {
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: Error) => toast.error(e.message || "Could not open the file."),
  });

  const rows = history.data ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="mr-2 size-4" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export candidate list</DialogTitle>
          <DialogDescription>
            Exports are generated on the server and recorded with your name, the scope and the row
            count. Contact details are only included when they are released to you for every row in
            scope.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="font-medium">Scope</div>
            {scoped ? (
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {scope.position_id ? <li>Position: {scope.position_id.slice(0, 8)}…</li> : null}
                {scope.organization_id ? <li>Client: {scope.organization_id.slice(0, 8)}…</li> : null}
                {scope.stage ? <li>Stage: {scope.stage}</li> : null}
                {scope.client_visibility ? <li>Visibility: {scope.client_visibility}</li> : null}
                {scope.recommendation ? <li>Recommendation: {scope.recommendation}</li> : null}
                {scope.score_band ? <li>Band: {scope.score_band}</li> : null}
                {scope.date_from || scope.date_to ? (
                  <li>
                    Applied {scope.date_from ?? "…"} → {scope.date_to ?? "…"}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-1 flex items-start gap-2 text-muted-foreground">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                Filter the list by a position or a client first — unlimited-scope exports are not
                allowed.
              </p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="export-include-contact"
              checked={includeContact}
              onCheckedChange={(v) => setIncludeContact(v === true)}
            />
            <Label htmlFor="export-include-contact" className="text-sm font-normal leading-snug">
              Include contact details (email, phone)
              <span className="block text-muted-foreground">
                Omitted for the whole file if any row in scope has contact details withheld from
                you. The omission is stated in the file header.
              </span>
            </Label>
          </div>

          {includeContact ? (
            <div className="ml-6 flex items-start gap-2 rounded-md border bg-muted/30 p-3">
              <Checkbox
                id="export-mask-contacts"
                checked={maskContacts}
                onCheckedChange={(v) => setMaskContacts(v === true)}
              />
              <Label htmlFor="export-mask-contacts" className="text-sm font-normal leading-snug">
                Mask contact details
                <span className="block text-muted-foreground">
                  Emails become j***@domain and phones show only the last two digits. Your choice
                  is recorded on the export audit record either way.
                </span>
              </Label>
            </div>
          ) : null}

          <div>
            <div className="mb-2 text-sm font-medium">Past exports</div>
            {history.isPending ? (
              <p className="text-sm text-muted-foreground">Loading exports…</p>
            ) : history.isError ? (
              <div className="flex items-center justify-between rounded-md border border-destructive/40 p-3 text-sm">
                <span className="text-destructive">Could not load your export history.</span>
                <Button size="sm" variant="outline" onClick={() => void history.refetch()}>
                  <RefreshCw className="mr-2 size-4" /> Retry
                </Button>
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No exports yet</p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {rows.map((r) => (
                  <li key={r.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className={STATUS_TONE[r.status] ?? ""} variant="secondary">
                            {r.status}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="mt-1 truncate font-medium">{r.scope_label ?? "Candidate list"}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.requester_name ?? "You"} · {fmt(r.requested_at)} ·{" "}
                          {r.row_count === null ? "—" : `${r.row_count} rows`} ·{" "}
                          {r.contact_included
                            ? r.contact_omission_reason?.includes("masked")
                              ? "contact masked"
                              : "contact included in full"
                            : "contact omitted"}
                        </div>
                        {r.contact_omission_reason ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {r.contact_omission_reason}
                          </div>
                        ) : null}
                        {r.status === "failed" && r.error ? (
                          <div className="mt-1 text-xs text-destructive">{r.error}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0">
                        {r.status === "failed" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={retry.isPending}
                            onClick={() => retry.mutate(r.id)}
                          >
                            <RefreshCw className="mr-2 size-4" /> Retry
                          </Button>
                        ) : r.downloadable ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={download.isPending}
                            onClick={() => download.mutate(r.id)}
                          >
                            <Download className="mr-2 size-4" /> Download
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Processing…</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button disabled={!scoped || request.isPending} onClick={() => request.mutate()}>
            {request.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Request export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
