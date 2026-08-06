import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileWarning, ScanLine, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  listParseFailures,
  markParseReviewedOffline,
  pasteCvText,
  requestCvReupload,
} from "@/lib/parse-failure/parse-failure.functions";

export const Route = createFileRoute("/_authenticated/admin/parse-failures")({
  head: () => ({
    meta: [
      { title: "Documents we could not read · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Every application whose document failed to parse, with the written cause, the next action, and the owner accountable for it.",
      },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
  component: ParseFailures,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const OWNER_LABEL: Record<string, string> = {
  recruiter: "Recruiter",
  candidate: "Candidate",
  engineering: "Engineering",
};

function ParseFailures() {
  const fetchQueue = useServerFn(listParseFailures);
  const ask = useServerFn(requestCvReupload);
  const paste = useServerFn(pasteCvText);
  const offline = useServerFn(markParseReviewedOffline);

  const [showTest, setShowTest] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [mode, setMode] = useState<"reupload" | "paste" | "offline" | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["admin", "parse-failures", showTest],
    queryFn: () => fetchQueue({ data: { include_test: showTest } }),
  });

  const rows: Any[] = (query.data as Any)?.rows ?? [];

  function open(rowKey: string, next: "reupload" | "paste" | "offline", prefill = "") {
    setOpenRow(rowKey);
    setMode(next);
    setDraft(prefill);
  }

  async function submit(row: Any) {
    setBusy(true);
    try {
      if (mode === "reupload") {
        if (!row.match_id) throw new Error("This document is not attached to an application yet.");
        await ask({ data: { matchId: row.match_id, message: draft.trim() } });
        toast.success("Re-upload requested");
      } else if (mode === "paste") {
        await paste({ data: { fileId: row.file_id, text: draft, matchId: row.match_id ?? null } });
        toast.success("Text saved — the application is queued to process again");
      } else if (mode === "offline") {
        await offline({ data: { fileId: row.file_id, matchId: row.match_id ?? null, note: draft.trim() } });
        toast.success("Marked as reviewed offline");
      }
      setMode(null);
      setOpenRow(null);
      setDraft("");
      await query.refetch();
    } catch (e: Any) {
      toast.error(e?.message ?? "Could not complete that action");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Documents we could not read</h1>
          <p className="text-sm text-muted-foreground">
            Every stuck document, its written cause, and the one action that closes the gap. Nothing
            here retries on its own.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showTest}
            onChange={(e) => setShowTest(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Show test records
        </label>
      </header>

      {query.isError && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>We could not load this queue</AlertTitle>
          <AlertDescription>
            {(query.error as Any)?.message ?? "Unexpected error"}{" "}
            <button type="button" className="underline" onClick={() => query.refetch()}>
              Try again
            </button>
          </AlertDescription>
        </Alert>
      )}

      {query.isLoading && <p className="text-sm text-muted-foreground">Loading the queue…</p>}

      {!query.isLoading && !query.isError && rows.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Every document currently on file was read successfully.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const key = `${row.file_id}:${row.match_id ?? "none"}`;
          const isOpen = openRow === key;
          return (
            <article key={key} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {row.needs_ocr ? (
                      <Badge variant="outline" className="gap-1 text-[11px]">
                        <ScanLine className="h-3 w-3" /> Needs OCR
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 text-[11px]">
                        <FileWarning className="h-3 w-3" /> {row.failure.label}
                      </Badge>
                    )}
                    <span className="text-sm font-medium">
                      {row.candidate_name ?? "Candidate"}
                      {row.position_title ? ` · ${row.position_title}` : ""}
                    </span>
                    {row.client_name && (
                      <span className="text-xs text-muted-foreground">{row.client_name}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.failure.cause}</p>
                  <p className="mt-1 text-sm">
                    <span className="font-medium">Next action:</span> {row.failure.nextAction}{" "}
                    <span className="text-muted-foreground">
                      · Owner: {OWNER_LABEL[row.failure.owner] ?? row.failure.owner}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {row.filename} · {row.attempts} extraction attempt
                    {row.attempts === 1 ? "" : "s"} · uploaded{" "}
                    {new Date(row.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                {row.match_id && (
                  <Link
                    to="/admin/candidates/$id"
                    params={{ id: row.match_id }}
                    className="text-sm underline underline-offset-2"
                  >
                    Open application
                  </Link>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!row.match_id || !row.failure.reuploadFixes}
                  onClick={() =>
                    open(
                      key,
                      "reupload",
                      row.failure.candidateMessage ??
                        "Please upload your CV again as a PDF with selectable text.",
                    )
                  }
                >
                  Request a re-upload
                </Button>
                <Button size="sm" variant="outline" onClick={() => open(key, "paste")}>
                  Paste the text in
                </Button>
                <Button size="sm" variant="ghost" onClick={() => open(key, "offline")}>
                  Mark reviewed offline
                </Button>
              </div>

              {isOpen && mode && (
                <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    {mode === "reupload"
                      ? "This exact wording is what the candidate reads. Keep it plain — no error codes."
                      : mode === "paste"
                        ? "Paste the document text. The uploaded file stays untouched and the source is recorded as manual."
                        : "Write what you checked and concluded. No profile is generated from this."}
                  </p>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={mode === "paste" ? 10 : 3}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy} onClick={() => submit(row)}>
                      {mode === "reupload"
                        ? "Send request"
                        : mode === "paste"
                          ? "Save text and re-queue"
                          : "Record review"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
