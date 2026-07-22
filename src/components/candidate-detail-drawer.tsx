// Universal candidate detail drawer.
// One canonical component used by every admin surface that opens a candidate.
// - submissionId (candidate_matches.id) is the primary identity when present.
// - When multiple roles exist for the candidate, the role selector switches the
//   entire drawer (position, application, CV, screening, score, evidence, client preview, history).
// - Never renders scores or admin state on the Client Preview tab; always renders the
//   Client Preview by hitting the client visibility bundle for the exact submissionId.
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getAdminMatch, retryParse, rescore, advanceProcessing, applyReviewDecision, markOcrDone } from "@/lib/processing.functions";
import { updateCandidateAsAdmin, repairCandidateIdentity } from "@/lib/admin-candidate-edit.functions";
import { setMatchClientVisibility } from "@/lib/admin.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

type Props = {
  open: boolean;
  submissionId: string | null;
  siblingSubmissions?: Array<{ id: string; position_title: string }>;
  onOpenChange: (open: boolean) => void;
  onSubmissionChange?: (id: string) => void;
};

function Field({
  label,
  value,
  source,
}: {
  label: string;
  value: React.ReactNode;
  source?: "candidate" | "cv_parsed" | "enriched" | "admin_corrected" | "inferred" | "legacy";
}) {
  const color: Record<string, string> = {
    candidate: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    cv_parsed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    enriched: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
    admin_corrected: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    inferred: "bg-muted text-muted-foreground",
    legacy: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  };
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm border-b border-border/60">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 flex items-start justify-between gap-2">
        <span className="min-w-0 break-words">{value ?? <span className="text-muted-foreground">—</span>}</span>
        {source && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${color[source]}`}>
            {source.replace("_", " ")}
          </span>
        )}
      </dd>
    </div>
  );
}

export function CandidateDetailDrawer({
  open,
  submissionId,
  siblingSubmissions,
  onOpenChange,
  onSubmissionChange,
}: Props) {
  const qc = useQueryClient();
  const getMatch = useServerFn(getAdminMatch);
  const updateFn = useServerFn(updateCandidateAsAdmin);
  const repairFn = useServerFn(repairCandidateIdentity);
  const setVis = useServerFn(setMatchClientVisibility);
  const retryParseFn = useServerFn(retryParse);
  const rescoreFn = useServerFn(rescore);
  const advanceFn = useServerFn(advanceProcessing);
  const decisionFn = useServerFn(applyReviewDecision);
  const ocrFn = useServerFn(markOcrDone);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-candidate-drawer", submissionId],
    queryFn: () => (submissionId ? getMatch({ data: { id: submissionId } }) : Promise.resolve(null)),
    enabled: !!submissionId && open,
  });

  const [tab, setTab] = useState("overview");
  useEffect(() => setTab("overview"), [submissionId]);

  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");

  // Edit form state
  const [edit, setEdit] = useState<AnyRow>({});
  const [lockEmail, setLockEmail] = useState(false);
  const [lockPhone, setLockPhone] = useState(false);

  const match = data?.match as AnyRow | undefined;
  const cp = match?.candidate_profiles as AnyRow | undefined;
  const pos = match?.positions as AnyRow | undefined;
  const evidence = data?.evidence as AnyRow | null;
  const cv = data?.cv as AnyRow | null;
  const runs = (data?.runs ?? []) as AnyRow[];
  const currentRun = runs[0];
  const jobs = (data?.jobs ?? []) as AnyRow[];
  const decisions = (data?.decisions ?? []) as AnyRow[];

  useEffect(() => {
    if (cp) {
      setEdit({
        full_name: cp.full_name ?? "",
        email: cp.email ?? "",
        phone: cp.phone ?? "",
        location: cp.location ?? "",
        headline: cp.headline ?? "",
      });
    }
  }, [cp?.id]);

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setFeedback(null);
    setError(null);
    try {
      const r = (await fn()) as { state?: string; action?: string; trace_id?: string; ok?: boolean; message?: string };
      if (r.ok === false) throw new Error(r.message ?? "failed");
      setFeedback(`${label} → ${r.state ?? r.action ?? "done"}${r.trace_id ? ` · ${r.trace_id}` : ""}`);
      await refetch();
      qc.invalidateQueries({ queryKey: ["candidate-search"] });
    } catch (e) {
      setError(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const saveMutation = useMutation({
    mutationFn: (surface: "admin_drawer_overview" | "admin_drawer_contact") => {
      if (!cp?.id) throw new Error("no profile id");
      const patch: AnyRow = {};
      for (const [k, v] of Object.entries(edit)) {
        if (v !== (cp[k] ?? "")) patch[k] = v === "" ? null : v;
      }
      if (Object.keys(patch).length === 0) throw new Error("nothing to save");
      const lock: string[] = [];
      if (lockEmail) lock.push("email");
      if (lockPhone) lock.push("phone");
      return updateFn({
        data: {
          candidate_profile_id: cp.id,
          source_surface: surface,
          match_id: submissionId ?? undefined,
          patch,
          lock_fields: lock.length ? lock : undefined,
        },
      });
    },
    onSuccess: (r: AnyRow) => {
      if (r.ok) {
        setFeedback(`Saved · ${r.trace_id}${r.scoring_relevant ? ` · ${r.stale_marked} score(s) marked stale` : ""}`);
        refetch();
        qc.invalidateQueries({ queryKey: ["candidate-search"] });
      } else {
        setError(r.message ?? "save failed");
      }
    },
    onError: (e) => setError((e as Error).message),
  });

  const stateColor = useMemo(() => {
    const state = match?.processing_state ?? "";
    const map: Record<string, string> = {
      scored: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      manual_review_required: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      failed: "bg-destructive/10 text-destructive",
      provider_blocked: "bg-destructive/10 text-destructive",
      ocr_required: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
    return map[state] ?? "bg-muted text-muted-foreground";
  }, [match?.processing_state]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-3 border-b">
          <SheetTitle className="text-lg">
            {cp?.full_name ?? (isLoading ? "Loading…" : "Candidate")}
          </SheetTitle>
          {match && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{cp?.email}</span>
              <span>·</span>
              <span>{pos?.title}</span>
              <span>·</span>
              <span>{pos?.organizations?.name}</span>
              <span className={`ml-auto rounded px-2 py-0.5 ${stateColor}`}>
                {(match.processing_state ?? "").replace(/_/g, " ")}
              </span>
              <Badge variant="outline">admin: {match.admin_status}</Badge>
              <Badge variant="outline">vis: {match.client_visibility}</Badge>
            </div>
          )}
          {siblingSubmissions && siblingSubmissions.length > 1 && (
            <div className="mt-2">
              <Label className="text-xs">Role context</Label>
              <Select
                value={submissionId ?? undefined}
                onValueChange={(id) => onSubmissionChange?.(id)}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {siblingSubmissions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.position_title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </SheetHeader>

        {feedback && <Alert className="mx-6 mt-3"><AlertDescription>{feedback}</AlertDescription></Alert>}
        {error && <Alert variant="destructive" className="mx-6 mt-3"><AlertDescription>{error}</AlertDescription></Alert>}

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-3 flex-wrap h-auto justify-start">
            {["overview","contact","application","parsed","enrichment","scoring","evidence","documents","preview","activity","admin","audit"].map((t) => (
              <TabsTrigger key={t} value={t} className="capitalize text-xs">{t}</TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1 px-6 pb-6">
            {!match && !isLoading && (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No submission selected.
              </div>
            )}

            <TabsContent value="overview" className="mt-4 space-y-3">
              <dl>
                <Field label="Full name" value={cp?.full_name} source="candidate" />
                <Field label="Headline" value={cp?.headline} source={cp?.headline ? "cv_parsed" : undefined} />
                <Field label="Location" value={cp?.location} source="candidate" />
                <Field label="Score" value={currentRun ? `${currentRun.score?.toFixed(1)} · ${currentRun.fit_label}` : "—"} />
                <Field label="Stage" value={match?.stage} />
                <Field label="Applied" value={match?.created_at ? new Date(match.created_at).toLocaleString() : "—"} />
                <Field label="Position" value={pos?.title} />
                <Field label="Client" value={pos?.organizations?.name} />
              </dl>
              {match?.processing_error_message && (
                <Alert variant="destructive">
                  <AlertTitle>{match.processing_error_code}</AlertTitle>
                  <AlertDescription>{match.processing_error_message}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="contact" className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Full name</Label>
                  <Input value={edit.full_name ?? ""} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={lockEmail} onChange={(e) => setLockEmail(e.target.checked)} />
                    Lock (block enrichment overwrite)
                  </label>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={lockPhone} onChange={(e) => setLockPhone(e.target.checked)} />
                    Lock
                  </label>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={edit.location ?? ""} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Headline</Label>
                  <Input value={edit.headline ?? ""} onChange={(e) => setEdit({ ...edit, headline: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate("admin_drawer_contact")}>
                  {saveMutation.isPending ? "Saving…" : "Save contact"}
                </Button>
                {!cp?.id && cp?.email && (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() =>
                      runAction("repair identity", () =>
                        repairFn({
                          data: {
                            email: cp.email,
                            full_name: cp.full_name ?? cp.email.split("@")[0],
                          },
                        }),
                      )
                    }
                  >
                    Repair Identity Link
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="application" className="mt-4 space-y-2 text-sm">
              <Field label="Application ID" value={<code className="text-xs">{match?.application_id}</code>} />
              <Field label="Position" value={pos?.title} />
              <Field label="Stage" value={match?.stage} />
              <Field label="Source" value={"web"} source="candidate" />
              <Field label="Screening answers" value={
                evidence?.screening_normalized
                  ? <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">{JSON.stringify(evidence.screening_normalized, null, 2)}</pre>
                  : "—"
              } />
            </TabsContent>

            <TabsContent value="parsed" className="mt-4 space-y-2 text-sm">
              <Field label="Parse state" value={match?.processing_state} />
              <Field label="Engine version" value={evidence?.engine_version} source="cv_parsed" />
              <Field label="Skills" value={
                Array.isArray(cp?.skills) && cp.skills.length > 0
                  ? <div className="flex flex-wrap gap-1">{cp.skills.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
                  : "—"
              } source="cv_parsed" />
              <Field label="Experience" value={
                Array.isArray(cp?.experience) && cp.experience.length > 0
                  ? <ul className="space-y-1">{cp.experience.map((e: AnyRow, i: number) => <li key={i} className="text-xs">{e.title} @ {e.company} ({e.start ?? "?"}–{e.end ?? "present"})</li>)}</ul>
                  : "—"
              } source="cv_parsed" />
              <Field label="Education" value={
                Array.isArray(cp?.education) && cp.education.length > 0
                  ? <ul className="space-y-1">{cp.education.map((e: AnyRow, i: number) => <li key={i} className="text-xs">{e.degree} — {e.school}</li>)}</ul>
                  : "—"
              } source="cv_parsed" />
              <Field label="Raw text sample" value={
                evidence?.raw_text_sample
                  ? <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">{evidence.raw_text_sample.slice(0, 800)}</pre>
                  : "—"
              } />
            </TabsContent>

            <TabsContent value="enrichment" className="mt-4 space-y-2 text-sm">
              <Field label="Languages" value={
                Array.isArray(cp?.languages) && cp.languages.length > 0
                  ? cp.languages.map((l: AnyRow) => l.name ?? l).join(", ")
                  : "—"
              } source="enriched" />
              <Field label="Work authorization" value={
                cp?.work_authorization && Object.keys(cp.work_authorization).length > 0
                  ? <pre className="text-xs bg-muted p-2 rounded">{JSON.stringify(cp.work_authorization, null, 2)}</pre>
                  : "—"
              } source="candidate" />
              <Field label="Availability" value={
                cp?.availability && Object.keys(cp.availability).length > 0
                  ? JSON.stringify(cp.availability)
                  : "—"
              } source="candidate" />
              <Field label="Compensation" value={
                cp?.compensation_preferences && Object.keys(cp.compensation_preferences).length > 0
                  ? JSON.stringify(cp.compensation_preferences)
                  : "—"
              } source="candidate" />
            </TabsContent>

            <TabsContent value="scoring" className="mt-4 space-y-3 text-sm">
              {!currentRun ? (
                <p className="text-muted-foreground">No score run yet.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-3">
                    <div className="text-3xl font-semibold tabular-nums">{currentRun.score?.toFixed(1)}</div>
                    <Badge>{currentRun.fit_label?.replace(/_/g, " ")}</Badge>
                    <span className="text-xs text-muted-foreground">
                      engine {currentRun.engine_version} · {new Date(currentRun.completed_at ?? "").toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{currentRun.explanation}</p>
                  {currentRun.contradiction_status && currentRun.contradiction_status !== "none" && (
                    <Alert variant="destructive">
                      <AlertTitle>{currentRun.contradiction_status.replace(/_/g, " ")}</AlertTitle>
                      <AlertDescription>Rescore recommended.</AlertDescription>
                    </Alert>
                  )}
                </>
              )}
              <Separator />
              <h4 className="font-medium">Score history</h4>
              <ul className="space-y-1 text-xs">
                {runs.length === 0 && <li className="text-muted-foreground">None.</li>}
                {runs.map((r) => (
                  <li key={r.id} className="flex justify-between border-b py-1">
                    <span>{r.completed_at && new Date(r.completed_at).toLocaleString()} · {r.engine_version}</span>
                    <span className="tabular-nums">{r.score?.toFixed(1)} · {r.fit_label}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="evidence" className="mt-4 space-y-2 text-sm">
              {!currentRun?.result ? (
                <p className="text-muted-foreground">No evidence yet.</p>
              ) : (
                <ul className="space-y-3">
                  {((currentRun.result as AnyRow).requirement_assessment ?? []).map((r: AnyRow) => (
                    <li key={r.id} className="rounded border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium">{r.required && <span className="text-destructive">* </span>}{r.text}</div>
                        <Badge variant={r.status === "met" ? "default" : r.status === "partial" ? "secondary" : "destructive"}>{r.status}</Badge>
                      </div>
                      {r.evidence?.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {r.evidence.map((e: AnyRow, i: number) => (
                            <li key={i}>“…{e.snippet}…” <code className="opacity-60">{e.location}</code></li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-4 space-y-2 text-sm">
              {!cv ? (
                <p className="text-muted-foreground">No CV on file.</p>
              ) : (
                <>
                  <Field label="Filename" value={cv.filename} />
                  <Field label="MIME" value={cv.mime_type} />
                  <Field label="Size" value={`${Math.round((cv.size ?? 0) / 1024)} KB`} />
                  <Field label="OCR used" value={cv.ocr_used ? "Yes" : "No"} />
                  <Field label="Extracted at" value={cv.extraction_completed_at ? new Date(cv.extraction_completed_at).toLocaleString() : "—"} />
                  <Field label="Attempts" value={cv.extraction_attempts} />
                  {cv.signed_url ? (
                    <div className="flex gap-2 pt-2">
                      <a href={cv.signed_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="secondary" size="sm">Preview CV</Button>
                      </a>
                      <a href={cv.signed_url} download={cv.filename}>
                        <Button variant="outline" size="sm">Download</Button>
                      </a>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTitle>Signed link failed</AlertTitle>
                      <AlertDescription>Refresh to retry — links expire in 5 minutes.</AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="preview" className="mt-4 space-y-2 text-sm">
              <Alert>
                <AlertTitle>Client Preview</AlertTitle>
                <AlertDescription>
                  Opens the exact client-visible view for this submission. Scores, admin notes, and processing state are hidden.
                </AlertDescription>
              </Alert>
              {submissionId && match?.organization_id && (
                <Link
                  to="/client/candidates/$id"
                  params={{ id: submissionId }}
                  search={{ org: match.organization_id, preview: "client_admin" }}
                  target="_blank"
                >
                  <Button variant="secondary" size="sm">Open client preview in new tab</Button>
                </Link>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-2 text-sm">
              <h4 className="font-medium">Processing jobs</h4>
              <ul className="text-xs font-mono space-y-1">
                {jobs.length === 0 && <li className="text-muted-foreground">None.</li>}
                {jobs.map((j) => (
                  <li key={j.id} className={j.status === "failed" ? "text-destructive" : ""}>
                    {new Date(j.created_at ?? "").toLocaleString()} · {j.job_type} → {j.status}
                    {j.error_code ? ` (${j.error_code}: ${j.error_message})` : ""}
                  </li>
                ))}
              </ul>
              <Separator />
              <h4 className="font-medium">Decisions</h4>
              <ul className="text-xs space-y-1">
                {decisions.length === 0 && <li className="text-muted-foreground">None.</li>}
                {decisions.map((d) => (
                  <li key={d.id}>
                    {new Date(d.created_at).toLocaleString()} · {d.decision_type}
                    {d.approved_score != null ? ` → ${d.approved_score}` : ""} · {d.reason ?? "—"}
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="admin" className="mt-4 space-y-2">
              {submissionId && (
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" disabled={!!busy} onClick={() => runAction("advance", () => advanceFn({ data: { match_id: submissionId } }))}>Advance pipeline</Button>
                  <Button variant="secondary" disabled={!!busy} onClick={() => runAction("retry parse", () => retryParseFn({ data: { match_id: submissionId } }))}>Retry parse</Button>
                  <Button variant="secondary" disabled={!!busy} onClick={() => runAction("rescore", () => rescoreFn({ data: { match_id: submissionId } }))}>Rescore</Button>
                  <Button variant="secondary" disabled={!!busy || match?.processing_state !== "scored"} onClick={() => runAction("approve for client", () => decisionFn({ data: { match_id: submissionId, action: "approve_for_client" } }))}>Approve & Publish</Button>
                  <Button variant="secondary" disabled={!!busy} onClick={() => runAction("hide", () => setVis({ data: { match_id: submissionId, visibility: "hidden" } }))}>Hide from Client</Button>
                  <Button variant="secondary" disabled={!!busy} onClick={() => runAction("hold", () => decisionFn({ data: { match_id: submissionId, action: "hold" } }))}>Hold</Button>
                  <Button variant="destructive" disabled={!!busy} onClick={() => runAction("archive", () => decisionFn({ data: { match_id: submissionId, action: "archive" } }))}>Archive</Button>
                </div>
              )}
              {match?.processing_state === "ocr_required" && submissionId && (
                <div className="pt-3">
                  <Label>OCR text (min 60 chars)</Label>
                  <Textarea rows={3} value={ocrText} onChange={(e) => setOcrText(e.target.value)} />
                  <Button
                    className="mt-2"
                    size="sm"
                    disabled={!!busy || ocrText.length < 60}
                    onClick={() => runAction("attach OCR", () => ocrFn({ data: { match_id: submissionId, ocr_text: ocrText } }))}
                  >
                    Attach OCR & continue
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4 space-y-2 text-xs">
              <p className="text-muted-foreground">Trace: <code>{match?.last_processing_trace_id}</code></p>
              <p className="text-muted-foreground">IDs</p>
              <ul className="font-mono space-y-0.5">
                <li>submission: {submissionId}</li>
                <li>application: {match?.application_id}</li>
                <li>candidate_profile: {cp?.id}</li>
                <li>position: {pos?.id}</li>
                <li>organization: {match?.organization_id}</li>
              </ul>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
