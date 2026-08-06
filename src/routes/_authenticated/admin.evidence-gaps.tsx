import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MessageSquareWarning, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { listEvidenceGaps } from "@/lib/evidence-gaps/evidence-gaps.functions";
import { OWNER_LABEL, TOLD_LABEL } from "@/lib/evidence-gaps/gap-reasons";

export const Route = createFileRoute("/_authenticated/admin/evidence-gaps")({
  head: () => ({
    meta: [
      { title: "Why candidates have no evidence · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Every candidate without evidence, with the step of ours that did not finish and what the candidate was told at the time.",
      },
    ],
  }),
  errorComponent: makeRouteErrorComponent(
    "admin",
    "src/routes/_authenticated/admin.evidence-gaps.tsx",
  ),
  component: EvidenceGaps;
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function toldTone(told: string) {
  if (told === "specific") return "text-muted-foreground";
  return "text-[color:var(--brand-danger)]";
}

function EvidenceGaps() {
  const fetchGaps = useServerFn(listEvidenceGaps);
  const [showTest, setShowTest] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "evidence-gaps", showTest],
    queryFn: () => fetchGaps({ data: { include_test: showTest } }),
  });

  const data = query.data as Any;
  const rows: Any[] = data?.rows ?? [];

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Why candidates have no evidence</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Each row names the step of ours that did not finish, and what the candidate saw at that
          moment. Where the message hid the real cause, the gap is ours to explain — not theirs to fix.
        </p>
        <button
          type="button"
          className="text-xs underline underline-offset-4 text-muted-foreground"
          onClick={() => setShowTest((v) => !v)}
        >
          {showTest ? "Hide test records" : "Show test records"}
        </button>
      </header>

      {query.isLoading ? <p className="text-sm text-muted-foreground">Reading the records…</p> : null}

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>We could not read the ledger</AlertTitle>
          <AlertDescription>
            {(query.error as Error)?.message ?? "Unknown error"} — this is a failure to load, not an
            empty result.
          </AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: "Candidates reached us", value: data.total_candidates_seen },
              { label: "Have evidence", value: data.total_with_evidence },
              { label: "No evidence", value: data.total_gaps },
              { label: "Caused by an unfinished step of ours", value: data.our_fault },
            ].map((tile) => (
              <div key={tile.label} className="rounded-lg border bg-card p-4">
                <p className="text-2xl font-semibold tabular-nums">{tile.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tile.label}</p>
              </div>
            ))}
          </div>

          {data.misinformed > 0 ? (
            <Alert>
              <MessageSquareWarning className="h-4 w-4" />
              <AlertTitle>
                {data.misinformed} of {data.total_gaps} were never told the real reason
              </AlertTitle>
              <AlertDescription>
                They either saw nothing, or saw a message that named the wrong problem. That is a
                communication defect on our side: they cannot act on a cause we did not state.
              </AlertDescription>
            </Alert>
          ) : null}

          {data.by_reason.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-medium">Grouped by cause</h2>
              <ul className="divide-y rounded-lg border bg-card">
                {data.by_reason.map((r: Any) => (
                  <li key={r.code} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-sm">{r.label}</span>
                    <span className="flex items-center gap-3">
                      {r.our_fault ? <Badge variant="destructive">Ours</Badge> : null}
                      <span className="text-sm font-semibold tabular-nums">{r.count}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-medium">Every affected candidate</h2>
            {rows.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                <SearchX className="h-4 w-4" />
                Every candidate who reached us has evidence recorded.
              </div>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {rows.map((row: Any) => {
                  const open = openRow === row.key;
                  return (
                    <li key={row.key} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-medium">
                            {row.candidate_name ?? row.candidate_email ?? "Unnamed candidate"}
                            {row.reference ? (
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {row.reference}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.position_title ?? "No role attached"}
                            {" · "}
                            {new Date(row.first_seen).toLocaleDateString()}
                            {row.upload_attempts > 1
                              ? ` · ${row.upload_attempts} upload attempts`
                              : ""}
                          </p>
                          <p className="text-sm">{row.reason.label}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline">{OWNER_LABEL[row.reason.owner as "recruiter"]}</Badge>
                          {row.reason.ourFault ? <Badge variant="destructive">Ours</Badge> : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setOpenRow(open ? null : row.key)}
                          >
                            {open ? "Hide" : "Detail"}
                          </Button>
                        </div>
                      </div>

                      {open ? (
                        <div className="mt-3 space-y-3 rounded-md bg-muted/40 p-4 text-sm">
                          <p>
                            <span className="font-medium">What happened: </span>
                            {row.reason.cause}
                          </p>
                          <p>
                            <span className="font-medium">Next action: </span>
                            {row.reason.nextAction}
                          </p>
                          <p className={toldTone(row.reason.candidateWasTold)}>
                            <span className="font-medium">
                              {TOLD_LABEL[row.reason.candidateWasTold as "nothing"]}:{" "}
                            </span>
                            {row.reason.candidateSaw ?? "No message was shown."}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.filename ? `Document on file: ${row.filename}. ` : ""}
                            {row.candidate_email ? `Contact: ${row.candidate_email}.` : ""}
                          </p>
                          {row.link_path ? (
                            <Link
                              to={row.link_path}
                              className="inline-block text-xs underline underline-offset-4"
                            >
                              Open the record
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
