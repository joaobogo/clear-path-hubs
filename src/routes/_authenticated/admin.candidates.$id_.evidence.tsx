import { makeRouteErrorComponent } from "@/components/workspace/route-states";
import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import {
  ArrowLeft,
  Download,
  FileText,
  ScanText,
  Sparkles,
  ListChecks,
  AlertTriangle,
  History,
  ShieldCheck,
} from "lucide-react";
import { getAdminMatch, downloadEvidenceRecord } from "@/lib/processing.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

export const Route = createFileRoute("/_authenticated/admin/candidates/$id_/evidence")({
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData({
      queryKey: ["admin-candidate", params.id],
      queryFn: () => getAdminMatch({ data: { id: params.id } }),
    });
    if (!d) throw notFound();
    return d;
  },
  head: () => ({
    meta: [
      { title: "Evidence record · TaaSFlow admin" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Grounded evidence, requirement mapping and audit trail for a candidate match." },
    ],
  }),
  notFoundComponent: () => (
    <div className="p-10 text-center text-muted-foreground">Match not found.</div>
  ),
  errorComponent: makeRouteErrorComponent("admin", "src/routes/_authenticated/admin.candidates.$id.evidence.tsx"),
  component: EvidenceViewer,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE });
  } catch {
    return iso;
  }
}

function EvidenceViewer() {
  const { id } = Route.useParams();
  const data = Route.useLoaderData() as Any;
  const { match, runs, evidence, cv, decisions } = data;
  const cp = match.candidate_profiles;
  const pos = match.positions;
  const currentRun =
    runs.find((r: Any) => r.id === match.current_score_run_id) ?? runs[0] ?? null;
  const result = currentRun?.result ?? {};
  const insights = evidence?.extracted?.insights ?? null;
  const parsed = evidence?.extracted ?? null;
  const enrichment = parsed?.enrichment ?? insights?.enrichment ?? null;
  const contradictions =
    result?.contradiction_status && result.contradiction_status !== "none"
      ? result.contradiction_status
      : null;

  const downloadFn = useServerFn(downloadEvidenceRecord);
  const [downloading, setDownloading] = useState(false);

  async function onDownload() {
    setDownloading(true);
    try {
      const record = await downloadFn({ data: { id } });
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evidence-${id.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Evidence record downloaded");
    } catch (e: Any) {
      toast.error(e?.message ?? "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const reqItems: Any[] = result?.requirement_assessment ?? result?.evidence ?? [];
  const llmVerdicts: Any[] = Array.isArray(insights?.requirement_verdicts)
    ? insights.requirement_verdicts
    : [];

  // Timeline: merge runs + decisions + cv/evidence updates
  const timeline: { at: string; kind: string; label: string; detail?: string }[] = [];
  if (cv?.created_at) timeline.push({ at: cv.created_at, kind: "cv", label: "CV uploaded", detail: cv.filename });
  if (cv?.extraction_completed_at)
    timeline.push({
      at: cv.extraction_completed_at,
      kind: "cv",
      label: cv.ocr_used ? "CV parsed with OCR" : "CV parsed",
    });
  if (evidence?.created_at)
    timeline.push({
      at: evidence.created_at,
      kind: "evidence",
      label: "Evidence snapshot generated",
      detail: `engine ${evidence.engine_version}`,
    });
  for (const r of runs as Any[])
    if (r.completed_at)
      timeline.push({
        at: r.completed_at,
        kind: "score",
        label: `Score run · ${r.fit_label ?? r.score ?? "—"}`,
        detail: `engine ${r.engine_version} · ${r.contradiction_status ?? "no contradictions"}`,
      });
  for (const d of (decisions ?? []) as Any[])
    timeline.push({
      at: d.created_at,
      kind: "decision",
      label: `${(d.decision_type as string) ?? "decision"} · ${d.approved_score ?? ""}`.trim(),
      detail: d.reason ?? undefined,
    });
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

  const cvExcerpt = (cv?.extracted_text as string | undefined) ?? evidence?.raw_text_sample ?? "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2 h-7">
            <Link to="/admin/candidates/$id" params={{ id }}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to workspace
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Evidence record
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {cp?.full_name ?? "Candidate"}{" "}
            <span className="font-normal text-muted-foreground">for {pos?.title ?? "role"}</span>
          </h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {pos?.organizations?.name ?? "—"} · match {id.slice(0, 8)} ·
            engine {currentRun?.engine_version ?? evidence?.engine_version ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onDownload} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Preparing…" : "Download record"}
          </Button>
        </div>
      </div>

      {/* Contradictions banner */}
      {contradictions && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Contradiction detected</AlertTitle>
          <AlertDescription>
            {String(contradictions).replace(/_/g, " ")} — resolve before publishing to the client.
          </AlertDescription>
        </Alert>
      )}

      {/* Provenance summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Score" value={currentRun?.score != null ? String(currentRun.score) : "—"} />
        <Tile label="Fit" value={currentRun?.fit_label ?? "—"} />
        <Tile
          label="Must-have coverage"
          value={
            currentRun?.must_have_coverage != null
              ? `${Math.round(currentRun.must_have_coverage * 100)}%`
              : "—"
          }
        />
        <Tile
          label="Contradictions"
          value={contradictions ? String(contradictions).replace(/_/g, " ") : "None"}
          tone={contradictions ? "destructive" : "success"}
        />
      </section>

      {/* CV excerpt */}
      <Section icon={FileText} title="CV excerpt" caption={cv?.filename ?? "No CV on file"}>
        {cvExcerpt ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-xs leading-relaxed">
            {cvExcerpt.slice(0, 8000)}
            {cvExcerpt.length > 8000 && "\n\n… truncated in preview; full text in the downloaded record."}
          </pre>
        ) : (
          <EmptyLine>No parsed CV text available.</EmptyLine>
        )}
      </Section>

      {/* Parsed facts */}
      <Section icon={ScanText} title="Parsed facts" caption="Structured signals extracted from the CV.">
        {parsed ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <FactBlock label="Headline" value={parsed.headline ?? cp?.headline} />
            <FactBlock label="Location" value={parsed.location ?? cp?.location} />
            <FactBlock label="Years experience" value={parsed.years_experience} />
            <FactBlock label="Languages" value={arr(parsed.languages)} />
            <FactBlock label="Skills" value={arr(parsed.skills)} full />
            <FactBlock label="Certifications" value={arr(parsed.certifications)} full />
          </div>
        ) : (
          <EmptyLine>No parsed facts yet.</EmptyLine>
        )}
      </Section>

      {/* Enrichment */}
      <Section icon={Sparkles} title="Enrichment evidence" caption="Model-derived signals with grounding.">
        {enrichment || insights?.enrichment_notes ? (
          <div className="space-y-3">
            {insights?.summary && (
              <p className="text-sm text-muted-foreground">{insights.summary}</p>
            )}
            {Array.isArray(insights?.strengths) && insights.strengths.length > 0 && (
              <BulletBlock label="Strengths" items={insights.strengths} tone="success" />
            )}
            {Array.isArray(insights?.risks) && insights.risks.length > 0 && (
              <BulletBlock label="Risks" items={insights.risks} tone="destructive" />
            )}
            {enrichment && (
              <details className="rounded-md border bg-muted/20 p-3 text-xs">
                <summary className="cursor-pointer font-medium">Raw enrichment payload</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(enrichment, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <EmptyLine>No enrichment on file.</EmptyLine>
        )}
      </Section>

      {/* Requirement mapping */}
      <Section
        icon={ListChecks}
        title="Requirement mapping"
        caption="Every declared requirement, mapped to the evidence we found."
      >
        {reqItems.length === 0 ? (
          <EmptyLine>No requirement assessment yet.</EmptyLine>
        ) : (
          <ul className="space-y-2">
            {reqItems.map((r: Any, i: number) => {
              const verdict = llmVerdicts.find(
                (v) =>
                  (v.requirement_id && v.requirement_id === r.id) ||
                  (v.requirement_text && v.requirement_text === (r.text ?? r.requirement_text)),
              );
              return (
                <li key={r.id ?? i} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 text-sm">
                      {r.required && <span className="text-destructive">* </span>}
                      <span className="font-medium">
                        {r.text ?? r.requirement_text ?? r.label ?? r.name}
                      </span>
                    </div>
                    {r.status && (
                      <Badge
                        variant={
                          r.status === "met"
                            ? "default"
                            : r.status === "partial"
                              ? "secondary"
                              : "destructive"
                        }
                        className="capitalize"
                      >
                        {String(r.status).replace(/_/g, " ")}
                      </Badge>
                    )}
                  </div>
                  {(r.evidence ?? []).length > 0 && (
                    <ul className="mt-2 space-y-1 border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground">
                      {(r.evidence as Any[]).map((e, j) => (
                        <li key={j}>
                          "…{e.snippet}…"{" "}
                          {e.location && <code className="opacity-60">{e.location}</code>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {verdict?.cv_quote && (
                    <blockquote className="mt-2 border-l-2 border-info/40 pl-3 text-xs italic text-muted-foreground">
                      AI verdict: <b className="capitalize">{verdict.verdict}</b> — "{verdict.cv_quote}"
                      {verdict.rationale && (
                        <span className="not-italic"> · {verdict.rationale}</span>
                      )}
                    </blockquote>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Contradictions detail */}
      <Section icon={AlertTriangle} title="Contradictions" caption="Signals that disagree with the CV or answers.">
        {Array.isArray(insights?.contradictions) && insights.contradictions.length > 0 ? (
          <ul className="space-y-2">
            {insights.contradictions.map((c: Any, i: number) => (
              <li key={i} className="rounded-md border bg-destructive/5 p-3 text-sm">
                <div className="font-medium">{c.title ?? c.subject ?? "Contradiction"}</div>
                {c.detail && <div className="mt-1 text-xs text-muted-foreground">{c.detail}</div>}
                {c.cv_quote && (
                  <blockquote className="mt-1 border-l-2 border-destructive/40 pl-3 text-xs italic">
                    "{c.cv_quote}"
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        ) : contradictions ? (
          <EmptyLine>
            Flagged as <b>{String(contradictions).replace(/_/g, " ")}</b> — see requirement mapping
            for the specific rows.
          </EmptyLine>
        ) : (
          <EmptyLine>No contradictions detected.</EmptyLine>
        )}
      </Section>

      {/* Timeline */}
      <Section icon={History} title="Timeline of evidence updates" caption="Every change to the record.">
        {timeline.length === 0 ? (
          <EmptyLine>No activity yet.</EmptyLine>
        ) : (
          <ol className="space-y-3 border-l border-border pl-4">
            {timeline.map((t, i) => (
              <li key={i} className="relative">
                <span
                  className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
                    t.kind === "score"
                      ? "bg-primary"
                      : t.kind === "decision"
                        ? "bg-success"
                        : t.kind === "cv"
                          ? "bg-info"
                          : "bg-muted-foreground/50"
                  }`}
                />
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(t.at)}
                  {t.detail && <span> · {t.detail}</span>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <p className="pt-2 text-xs text-muted-foreground">
        Records are downloadable for internal audit. Redact before sharing outside the org.
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold ${
          tone === "destructive"
            ? "text-destructive"
            : tone === "success"
              ? "text-success"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  caption,
  children,
}: {
  icon: Any;
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex items-start gap-3 border-b p-4">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function FactBlock({
  label,
  value,
  full,
}: {
  label: string;
  value?: Any;
  full?: boolean;
}) {
  const render =
    value == null || value === "" || (Array.isArray(value) && value.length === 0)
      ? "—"
      : Array.isArray(value)
        ? value.join(", ")
        : String(value);
  return (
    <div className={`rounded-md border bg-muted/20 p-3 ${full ? "sm:col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{render}</div>
    </div>
  );
}

function BulletBlock({
  label,
  items,
  tone,
}: {
  label: string;
  items: Any[];
  tone: "success" | "destructive";
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium">{label}</div>
      <ul className="space-y-1 text-sm">
        {items.map((it: Any, i: number) => (
          <li
            key={i}
            className={`rounded-md border p-2 ${
              tone === "success"
                ? "border-success/30 bg-success/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            {typeof it === "string" ? it : it?.text ?? it?.title ?? JSON.stringify(it)}
            {typeof it !== "string" && it?.cv_quote && (
              <blockquote className="mt-1 border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                "{it.cv_quote}"
              </blockquote>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function arr(v: Any): string[] | undefined {
  if (!v) return undefined;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x?.name ?? x?.label ?? JSON.stringify(x)));
  return [String(v)];
}
