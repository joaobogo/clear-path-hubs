// Step 6 of the position wizard: employer-brand personalisation of the public
// job post, plus a live desktop/mobile preview of what candidates will see.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type JobPostFields = {
  title: string;
  department: string;
  location: string;
  work_model: string;
  employment_type: string;
  seniority: string;
  description: string;
  responsibilities: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  education: string;
  experience: string;
  currency: string;
  budget_min: string;
  budget_max: string;
  company_intro: string;
  benefits: string;
  languages: string;
  travel: string;
  work_authorization_note: string;
  accessibility_note: string;
  eeo_statement: string;
  brand_tone: string;
  application_deadline: string;
  confidentiality: string;
  screening_questions: { question: string; required: boolean; answer_type: string }[];
};

const TONES = [
  { value: "professional", label: "Professional — clear and formal" },
  { value: "warm", label: "Warm — human and welcoming" },
  { value: "direct", label: "Direct — short, no fluff" },
  { value: "technical", label: "Technical — precise, detail-led" },
  { value: "mission", label: "Mission-led — purpose forward" },
];

function Block({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PreviewSection({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
    </section>
  );
}

export function JobPostStep({
  value,
  onChange,
}: {
  value: JobPostFields;
  onChange: <K extends keyof JobPostFields>(key: K, v: JobPostFields[K]) => void;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const pay =
    value.budget_min || value.budget_max
      ? `${value.currency || "USD"} ${value.budget_min || "—"} – ${value.budget_max || "—"}`
      : "";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Block
          label="Employer-brand voice"
          hint="Sets the tone we use when the post is written and distributed."
        >
          <Select
            value={value.brand_tone || undefined}
            onValueChange={(v) => onChange("brand_tone", v)}
          >
            <SelectTrigger data-field="brand_tone">
              <SelectValue placeholder="Choose a tone" />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Block>

        <Block label="Confidentiality" hint="Confidential posts hide your company name publicly.">
          <Select
            value={value.confidentiality || "public"}
            onValueChange={(v) => onChange("confidentiality", v)}
          >
            <SelectTrigger data-field="confidentiality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public — company named</SelectItem>
              <SelectItem value="confidential">Confidential — company withheld</SelectItem>
            </SelectContent>
          </Select>
        </Block>

        <Block label="Application deadline" hint="Optional. Leave blank for open-ended.">
          <Input
            type="date"
            value={value.application_deadline}
            onChange={(e) => onChange("application_deadline", e.target.value)}
          />
        </Block>

        <Block label="Languages" hint="e.g. English (fluent), Spanish (working)">
          <Input
            value={value.languages}
            maxLength={500}
            onChange={(e) => onChange("languages", e.target.value)}
          />
        </Block>

        <Block label="Travel expectation" hint="e.g. Up to 20% domestic travel">
          <Input
            value={value.travel}
            maxLength={300}
            onChange={(e) => onChange("travel", e.target.value)}
          />
        </Block>

        <Block label="Work authorization" hint="e.g. Must hold EU work rights; no sponsorship.">
          <Input
            value={value.work_authorization_note}
            maxLength={600}
            onChange={(e) => onChange("work_authorization_note", e.target.value)}
          />
        </Block>
      </div>

      <Block label="Company introduction" hint="Two or three lines candidates read first.">
        <Textarea
          rows={3}
          maxLength={4000}
          value={value.company_intro}
          onChange={(e) => onChange("company_intro", e.target.value)}
        />
      </Block>

      <Block label="Benefits and perks" hint="One per line works best.">
        <Textarea
          rows={4}
          maxLength={4000}
          value={value.benefits}
          onChange={(e) => onChange("benefits", e.target.value)}
        />
      </Block>

      <Block
        label="Accessibility and accommodations"
        hint="How candidates can request adjustments during the process."
      >
        <Textarea
          rows={3}
          maxLength={1500}
          value={value.accessibility_note}
          onChange={(e) => onChange("accessibility_note", e.target.value)}
        />
      </Block>

      <Block label="Equal-opportunity statement">
        <Textarea
          rows={3}
          maxLength={3000}
          value={value.eeo_statement}
          onChange={(e) => onChange("eeo_statement", e.target.value)}
        />
      </Block>

      <div className="space-y-3 rounded-lg border p-3 sm:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">Candidate-facing preview</h2>
            <p className="text-xs text-muted-foreground">
              Exactly what applicants see, including required questions.
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="sm"
              variant={device === "desktop" ? "default" : "outline"}
              onClick={() => setDevice("desktop")}
            >
              Desktop
            </Button>
            <Button
              type="button"
              size="sm"
              variant={device === "mobile" ? "default" : "outline"}
              onClick={() => setDevice("mobile")}
            >
              Mobile
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <article
            className={
              device === "mobile"
                ? "mx-auto w-[320px] space-y-4 rounded-lg border bg-card p-4"
                : "space-y-4 rounded-lg border bg-card p-5"
            }
          >
            <header className="space-y-1">
              <h1 className="text-lg font-semibold">{value.title || "Untitled role"}</h1>
              <p className="text-sm text-muted-foreground">
                {[
                  value.confidentiality === "confidential" ? "Confidential employer" : null,
                  value.department,
                  value.location,
                  value.work_model,
                  value.employment_type?.replace("_", " "),
                  value.seniority,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Details to be confirmed"}
              </p>
              {pay ? <p className="text-sm font-medium">{pay}</p> : null}
              {value.application_deadline ? (
                <p className="text-xs text-muted-foreground">
                  Applications close {value.application_deadline}
                </p>
              ) : null}
            </header>

            <PreviewSection title="About the company" body={value.company_intro} />
            <PreviewSection title="About the role" body={value.description} />
            <PreviewSection title="What you'll do" body={value.responsibilities} />

            {value.must_have_skills.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Required qualifications</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {value.must_have_skills.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                  {value.experience ? <li>{value.experience} experience</li> : null}
                  {value.education ? <li>{value.education}</li> : null}
                </ul>
              </section>
            )}

            {value.nice_to_have_skills.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Preferred qualifications</h3>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {value.nice_to_have_skills.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            )}

            <PreviewSection title="Languages" body={value.languages} />
            <PreviewSection title="Travel" body={value.travel} />
            <PreviewSection title="Work authorization" body={value.work_authorization_note} />
            <PreviewSection title="Benefits" body={value.benefits} />
            <PreviewSection title="Accessibility" body={value.accessibility_note} />
            <PreviewSection title="Equal opportunity" body={value.eeo_statement} />

            {value.screening_questions.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold">Application questions</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  {value.screening_questions.map((q, i) => (
                    <li key={`${q.question}-${i}`}>
                      {q.question}
                      {q.required ? " *" : ""}{" "}
                      <span className="text-xs">({q.answer_type})</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <p className="text-xs text-muted-foreground">
              Every applicant uploads a PDF CV as part of the application.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
