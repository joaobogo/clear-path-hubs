import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Link } from "@tanstack/react-router";
import {
  BLUEPRINT_STAGES,
  blueprintProgress,
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
  const status: string = position?.blueprint_status ?? "none";
  if (status === "none" || !status) return null;

  const bp = position?.blueprint as AnyRow | null;
  const ready = status === "ready";
  const failed = status === "failed";
  const stageIndex = BLUEPRINT_STAGES.findIndex((s) => s.key === status);
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
            <h2 className="text-base font-semibold">Role blueprint</h2>
            <p className="text-sm text-muted-foreground">
              {ready
                ? "Prepared from your job description and public company information. Every answer is editable."
                : failed
                  ? "Automated preparation didn't complete — a TaaSFlow specialist is finishing this brief."
                  : "We're preparing this role now. You can keep working — nothing is blocked."}
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
          {ready && !confirmedAt && audience === "client" && onConfirm && (
            <Button size="sm" onClick={onConfirm} disabled={confirming}>
              {confirming ? "Confirming…" : "Looks right"}
            </Button>
          )}
        </div>
      </header>

      {!ready && (
        <div className="space-y-3 p-4">
          <Progress value={blueprintProgress(status)} />
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
              <span>Prepared {new Date(position.blueprint_generated_at).toLocaleString()}</span>
            )}
          </footer>
        </div>
      )}
    </section>
  );
}
