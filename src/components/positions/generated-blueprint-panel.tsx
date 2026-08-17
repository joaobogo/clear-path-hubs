import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { retryBlueprintAnalysis } from "@/lib/blueprint.functions";
import { toast } from "sonner";
import { trackEvent } from "@/lib/tracking/pixels";
import {
  BLUEPRINT_STAGES,
  blueprintProgress,
  blueprintStageIndex,
} from "@/lib/express-intake-schema";
import {
  CheckCircle2,
  CircleDashed,
  FileText,
  Globe,
  Loader2,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { APP_LOCALE, WORKSPACE_TIMEZONE } from "@/lib/format/datetime";

/**
 * GeneratedBlueprintPanel — surfaces the express-onboarding blueprint on both
 * the client and admin position pages.
 *
 * It is deliberately honest about provenance: every generated answer is
 * labelled with where it came from (job description, company website, or an
 * inference), and low-confidence fields plus open questions are shown rather
 * than hidden. Nothing here is presented as a confirmed fact until a human
 * confirms it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export interface GeneratedBlueprintPanelProps {
  position: AnyRow;
  audience: "client" | "admin";
  /** Deep link to the requisition editor so every answer stays editable. */
  editTo?: { to: string; params: Record<string, string> };
  onConfirm?: () => void;
  confirming?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  job_description: "From job description",
  company_website: "From company website",
  inferred: "Inferred — please confirm",
};

function sourceTone(source?: string) {
  if (source === "job_description") return "border-emerald-500/40 text-emerald-700 dark:text-emerald-400";
  if (source === "company_website") return "border-sky-500/40 text-sky-700 dark:text-sky-400";
  return "border-amber-500/40 text-amber-700 dark:text-amber-500";
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

function Field({
  label,
  value,
  source,
}: {
  label: string;
  value?: string | number | null;
  source?: string;
}) {
  if (value === null || value === undefined || value === "" ) return null;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        {source && (
          <Badge variant="outline" className={`text-[10px] ${sourceTone(source)}`}>
            {SOURCE_LABEL[source] ?? source}
          </Badge>
        )}
      </div>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function Chips({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="font-normal">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function GeneratedBlueprintPanel({
  position,
  audience,
  editTo,
  onConfirm,
  confirming,
}: GeneratedBlueprintPanelProps) {
  const router = useRouter();
  const retry = useServerFn(retryBlueprintAnalysis);
  const [retrying, setRetrying] = useState(false);
  const status: string = position?.blueprint_status ?? "none";
  const positionStatus = position?.status ?? "draft";
  const isDecisionReady = positionStatus === "active" || positionStatus === "closed" || positionStatus === "archived";
  const ready = status === "ready";

  // If the search is closed, we don't show the builder widget.
  if (positionStatus === "closed") return null;

  // If the blueprint is already prepared, or if the role is decision-ready (active/archived),
  // we don't show the "being built" widget.
  if (ready || status === "none" || !status || isDecisionReady) return null;

  async function handleRetry() {
    if (retrying) return;
    setRetrying(true);
    trackEvent("blueprint_reanalysis_requested", { position_id: position?.id });
    try {
      const res = await retry({ data: { positionId: position.id as string } });
      if (res.ok) toast.success("Analysis finished. Your role blueprint is ready.");
      else if (res.reason === "already_running") toast.info("Analysis is already running.");
      else toast.error("TaaSFlow could not finish the analysis. Try again or paste the job description.");
      await router.invalidate();
    } catch {
      toast.error("Something went wrong starting the analysis.");
    } finally {
      setRetrying(false);
    }
  }

  const bp = position?.blueprint as AnyRow | null;
  const failed = status === "failed";
  const stageIndex = blueprintStageIndex(status, position);
  const sources: Record<string, string> = (bp?.field_sources ?? {}) as Record<string, string>;
  const confirmedAt = position?.blueprint_confirmed_at as string | null;

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg border bg-muted/40 p-2">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold">
              {ready || failed ? "Role blueprint" : "Your role is being built"}
            </h2>
            <p className="text-sm text-muted-foreground">
            {ready
                ? "Prepared from your job description and public company information. Every answer is editable."
                : failed
                  ? position?.blueprint_error === "job_description_unreadable" 
                    ? "TaaSFlow could not read the job description document. Please upload a clear PDF/DOCX or paste the text instead."
                    : "Your role was saved, but TaaSFlow could not finish analyzing the document. Try the analysis again or paste the job description."
                  : "TaaSFlow is analyzing the job description, completing the role blueprint, calibrating the screening criteria, and preparing the sourcing plan. You can review or edit every detail as soon as the blueprint is ready."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ready && (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
              Ready for review
            </Badge>
          )}
          {confirmedAt && <Badge variant="secondary">Confirmed</Badge>}
          {editTo && (
            <Button asChild size="sm" variant="outline">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link to={editTo.to as any} params={editTo.params as any}>
                <Wand2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Edit answers
              </Link>
            </Button>
          )}
          {failed && (
            <Button size="sm" onClick={handleRetry} disabled={retrying}>
              {retrying ? "Analyzing…" : "Try analysis again"}
            </Button>
          )}
          {ready && !confirmedAt && audience === "client" && onConfirm && (
            <Button size="sm" onClick={onConfirm} disabled={confirming}>
              {confirming ? "Confirming…" : "Looks right"}
            </Button>
          )}
        </div>
      </header>

      {!ready && (
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {failed
                ? "Stopped before completion"
                : stageIndex >= BLUEPRINT_STAGES.length
                  ? "Final stage"
                  : stageIndex > -1
                    ? `Stage ${stageIndex + 1} of ${BLUEPRINT_STAGES.length}`
                    : "Queued"}
            </span>
            <span>No countdown — this updates as each stage completes.</span>
          </div>
          <ol className="flex gap-1.5" aria-hidden>
            {BLUEPRINT_STAGES.map((stage, i) => (
              <li
                key={`bar-${stage.key}`}
                className={
                  "h-1.5 flex-1 rounded-full " +
                  (stageIndex > -1 && i < stageIndex
                    ? "bg-primary"
                    : !failed && i === stageIndex
                      ? "bg-primary/50"
                      : "bg-muted")
                }
              />
            ))}
          </ol>
          <ol className="grid gap-2 sm:grid-cols-2">
            {BLUEPRINT_STAGES.map((stage, i) => {
              const complete = stageIndex > -1 && i < stageIndex;
              const active = !failed && i === stageIndex;
              return (
                <li key={stage.key} className="flex items-start gap-2 text-sm">
                  {complete ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : active ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : failed ? (
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  ) : (
                    <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className={complete || active ? "" : "text-muted-foreground"}>{stage.label}</span>
                </li>
              );
            })}
          </ol>
          {!failed && audience === "client" && (
            <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p>You do not need to keep this page open. TaaSFlow will email you when the role blueprint is ready.</p>
              <p>
                First candidate activity usually begins within 3–5 days after the search goes live. Your
                complete pilot runs in days.
              </p>
            </div>
          )}
          {failed && audience === "admin" && position?.blueprint_error && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 font-mono text-xs">
              {String(position.blueprint_error).slice(0, 300)}
            </p>
          )}
        </div>
      )}

      {ready && bp && (
        <div className="space-y-6 p-4">
          {bp.role?.summary && <p className="text-sm leading-relaxed">{bp.role.summary}</p>}

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Seniority" value={bp.role?.seniority} source={sources.seniority} />
            <Field label="Department" value={bp.role?.department} source={sources.department} />
            <Field label="Work model" value={bp.role?.work_model} source={sources.work_model} />
            <Field label="Employment type" value={bp.role?.employment_type} source={sources.employment_type} />
            <Field label="Location" value={bp.role?.location} source={sources.location} />
            <Field label="Openings" value={bp.role?.headcount} source={sources.headcount} />
            <Field label="Experience" value={bp.candidate_profile?.experience} source={sources.experience} />
            <Field label="Education" value={bp.candidate_profile?.education} source={sources.education} />
            <Field label="Languages" value={bp.candidate_profile?.languages} source={sources.languages} />
            <Field
              label="Work authorization"
              value={bp.candidate_profile?.work_authorization}
              source={sources.work_authorization}
            />
            <Field label="Timezone" value={bp.geography?.timezone_requirements} source={sources.timezone} />
            <Field label="Travel" value={bp.geography?.travel_expectation} source={sources.travel} />
            <Field label="Urgency" value={bp.timeline?.hiring_urgency} source={sources.hiring_urgency} />
            <Field label="Target start" value={bp.timeline?.target_start_date} source={sources.start_date} />
            <Field
              label="Compensation"
              value={
                bp.compensation?.min || bp.compensation?.max
                  ? `${bp.compensation?.currency ?? ""} ${bp.compensation?.min ?? "—"}–${bp.compensation?.max ?? "—"}`.trim()
                  : bp.compensation?.note
              }
              source={sources.compensation}
            />
          </dl>

          <div className="grid gap-5 md:grid-cols-2">
            <Chips label="Must-have skills" items={list(bp.must_have_skills)} />
            <Chips label="Nice to have" items={list(bp.nice_to_have_skills)} />
            <Chips label="Tools & platforms" items={list(bp.tools_platforms)} />
            <Chips label="Certifications" items={list(bp.certifications)} />
            <Chips label="Dealbreakers" items={list(bp.dealbreakers)} />
            <Chips label="Target countries" items={list(bp.geography?.target_countries)} />
          </div>

          {list(bp.responsibilities).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Responsibilities</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {list(bp.responsibilities).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(bp.screening_questions) && bp.screening_questions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Screening questions ({bp.screening_questions.length})
              </p>
              <ul className="space-y-2 text-sm">
                {bp.screening_questions.map((q: AnyRow, i: number) => (
                  <li key={`${i}-${q?.question}`} className="rounded-md border p-3">
                    <p>{q?.question}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {q?.required && <Badge variant="secondary">Required</Badge>}
                      {q?.dealbreaker && <Badge variant="destructive">Dealbreaker</Badge>}
                      <Badge variant="outline">{q?.answer_type}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bp.sourcing_plan && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium">Sourcing plan</p>
              <Chips label="Target titles" items={list(bp.sourcing_plan.target_titles)} />
              <Chips label="Target company types" items={list(bp.sourcing_plan.target_company_types)} />
              <Chips label="Channels" items={list(bp.sourcing_plan.channels)} />
              {bp.sourcing_plan.outreach_angle && (
                <p className="text-sm text-muted-foreground">{bp.sourcing_plan.outreach_angle}</p>
              )}
            </div>
          )}

          {(list(bp.open_questions).length > 0 || list(bp.assumptions).length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {list(bp.open_questions).length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                  <p className="text-sm font-medium">Worth confirming</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {list(bp.open_questions).map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {list(bp.assumptions).length > 0 && (
                <div className="space-y-2 rounded-lg border p-4">
                  <p className="text-sm font-medium">Assumptions we made</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {list(bp.assumptions).map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <footer className="flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
            {position?.jd_file_name && (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" aria-hidden />
                {position.jd_file_name}
              </span>
            )}
            {position?.company_research?.ok && (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" aria-hidden />
                Company website reviewed
              </span>
            )}
            {typeof bp.confidence?.overall === "number" && (
              <span>Confidence {Math.round(bp.confidence.overall * 100)}%</span>
            )}
            {position?.blueprint_generated_at && (
              <span>Prepared {new Date(position.blueprint_generated_at).toLocaleString(APP_LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: WORKSPACE_TIMEZONE })}</span>
            )}
          </footer>
        </div>
      )}
    </section>
  );
}
