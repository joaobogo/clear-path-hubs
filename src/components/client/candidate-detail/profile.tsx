import { memo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCopy,
  Coins,
  ExternalLink,
  Github,
  Globe,
  GraduationCap,
  Linkedin,
  MessageSquare,
} from "lucide-react";
import { CvDownloadAudit } from "@/components/cv-download-audit";
import { DownloadCvButton } from "@/components/download-cv-button";
import { CvPreviewDialog } from "@/components/cv-preview-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import { formatPeriod } from "@/lib/format/datetime";
import { formatEnumLabel } from "@/lib/human-labels";
import { SectionCard } from "./shared";

export const InterviewGuide = memo(function InterviewGuide({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const guide = candidate.interview_guide;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = guide
      .map(
        (q) =>
          `• ${q.question}\n  Why: ${q.why}\n  Look for: ${q.indicators.join("; ")}` +
          (q.followUp ? `\n  Follow-up: ${q.followUp}` : ""),
      )
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      toast.success("Interview guide copied");
      setTimeout(() => setCopied(false), 2000);
    });
  };
  if (guide.length === 0) return null;

  const groups = guide.reduce<Record<string, typeof guide>>((acc, q) => {
    (acc[q.group] ||= []).push(q);
    return acc;
  }, {});

  return (
    <SectionCard
      title="Personalised interview guide"
      icon={<MessageSquare className="h-4 w-4" />}
      description="Grounded in this candidate's evidence and this role's requirements."
      action={
        <Button variant="ghost" size="sm" onClick={copy} aria-label="Copy interview guide">
          {copied ? (
            <>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Copy guide
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-4">
        {Object.entries(groups).map(([group, qs]) => (
          <div key={group}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </h3>
            <ol className="space-y-3">
              {qs.map((q, i) => (
                <li key={q.id} className="rounded-md border bg-background/40 p-3">
                  <p className="font-medium text-sm">
                    <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                    {q.question}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">Why: </span>
                    {q.why}
                  </p>
                  {q.indicators.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-foreground/80">
                      {q.indicators.map((ind, j) => (
                        <li key={j} className="flex gap-1.5">
                          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 taas-fg-success" aria-hidden />
                          <span>{ind}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.followUp && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Follow-up: {q.followUp}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </SectionCard>
  );
});

export const ExperienceTimeline = memo(function ExperienceTimeline({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  if (candidate.experience.length === 0) return null;
  return (
    <SectionCard title="Career experience" icon={<Briefcase className="h-4 w-4" />}>
      <ol className="relative space-y-4 border-l border-muted pl-5">
        {candidate.experience.map((e, i) => (
          <li key={i} className="relative">
            <span
              className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary/70"
              aria-hidden
            />
            <div className="text-sm font-medium">{e.title}</div>
            <div className="text-xs text-muted-foreground">
              {[e.company, formatPeriod(e.period)].filter(Boolean).join(" · ")}
            </div>
            {e.description && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {e.description}
              </p>
            )}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
});

export const SkillsAndEducation = memo(function SkillsAndEducation({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const hasAny =
    candidate.skills.length > 0 ||
    candidate.education.length > 0 ||
    candidate.certifications.length > 0 ||
    candidate.languages.length > 0;
  if (!hasAny) return null;

  return (
    <SectionCard title="Skills, education, and languages" icon={<GraduationCap className="h-4 w-4" />}>
      <div className="grid gap-4 sm:grid-cols-2">
        {candidate.skills.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Skills
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {candidate.skills.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {candidate.languages.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Languages
            </h3>
            <ul className="space-y-1 text-sm">
              {candidate.languages.map((l, i) => (
                <li key={i}>
                  <span className="font-medium">{l.name}</span>
                  {l.level && <span className="text-muted-foreground"> — {l.level}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {candidate.education.length > 0 && (
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Education
            </h3>
            <ul className="space-y-2 text-sm">
              {candidate.education.map((e, i) => (
                <li key={i}>
                  <div className="font-medium">{e.degree ?? "Not specified"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[e.institution, formatPeriod(e.period)].filter(Boolean).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {candidate.certifications.length > 0 && (
          <div className="sm:col-span-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Certifications
            </h3>
            <ul className="space-y-1 text-sm">
              {candidate.certifications.map((c, i) => (
                <li key={i}>
                  <BadgeCheck className="mr-1 inline h-3.5 w-3.5 text-primary" aria-hidden />
                  <span className="font-medium">{c.name}</span>
                  {c.issuer && <span className="text-muted-foreground"> · {c.issuer}</span>}
                  {c.date && <span className="text-muted-foreground"> · {c.date}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
});

export const ProfilePanel = memo(function ProfilePanel({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const c = candidate.candidate;
  const rows: Array<[string, string | null | undefined]> = [
    ["Full name", c.full_name],
    ["Email", c.email],
    ["Phone", c.phone],
    ["Location", c.location],
    ["Timezone", c.timezone],
    ["Availability", c.availability],
    ["Years of experience", c.years_experience != null ? `${c.years_experience}` : null],
    ["Current role", c.current_role],
    ["Current company", c.current_company],
    ["Work authorization", formatEnumLabel(candidate.work_authorization)],
    [
      "Languages",
      candidate.languages.length > 0
        ? candidate.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(", ")
        : null,
    ],
  ];
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Profile</h2>
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[9rem_1fr] gap-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd>{value || <span className="text-muted-foreground">Not provided</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
});

export const LinksPanel = memo(function LinksPanel({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const links = candidate.candidate.links;
  const entries: Array<{ label: string; url: string | null; icon: React.ReactNode }> = [
    { label: "LinkedIn", url: links.linkedin, icon: <Linkedin className="h-4 w-4" aria-hidden /> },
    { label: "Portfolio", url: links.portfolio, icon: <Globe className="h-4 w-4" aria-hidden /> },
    { label: "GitHub", url: links.github, icon: <Github className="h-4 w-4" aria-hidden /> },
    { label: "Website", url: links.website, icon: <Building2 className="h-4 w-4" aria-hidden /> },
  ];
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">Links &amp; CV</h2>
      <ul className="space-y-2 text-sm">
        {entries.map((e) => (
          <li key={e.label} className="flex items-center gap-2">
            {e.icon}
            <span className="w-20 text-xs text-muted-foreground">{e.label}</span>
            {e.url ? (
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-primary hover:underline"
                aria-label={`Open ${e.label} (opens in new tab)`}
              >
                {e.url.replace(/^https?:\/\//, "")}
                <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
              </a>
            ) : (
              <span className="flex-1 text-muted-foreground">Not provided</span>
            )}
          </li>
        ))}
        {candidate.contact_released ? (
          <>
            <li className="flex flex-wrap items-center gap-2 pt-1">
              <CvPreviewDialog
                matchId={candidate.match_id}
                candidateName={candidate.candidate.display_name}
              />
              <DownloadCvButton matchId={candidate.match_id} mode="download" />
            </li>
            <li className="pt-2">
              <CvDownloadAudit
                matchId={candidate.match_id}
                title="Who downloaded this CV"
                limit={15}
              />
            </li>
          </>
        ) : (
          <li className="pt-1 text-xs text-muted-foreground">
            Contact details and CV are released as soon as a candidate is
            published to you.
          </li>
        )}




      </ul>
    </div>
  );
});

export const AvailabilityAndComp = memo(function AvailabilityAndComp({
  candidate,
}: {
  candidate: ClientCandidateDTO;
}) {
  const av = candidate.candidate.availability;
  const tz = candidate.candidate.timezone;
  const auth = candidate.work_authorization;

  return (
    <SectionCard
      title="Availability & work authorization"
      icon={<Coins className="h-4 w-4" />}
      description="Timeline and legal requirements for this candidate."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border bg-background/40 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Availability
          </div>
          <div className="mt-1 text-sm font-medium">{av ?? "Not specified"}</div>
          {tz && <div className="text-xs text-muted-foreground">Timezone {tz}</div>}
        </div>
        <div className="rounded-md border bg-background/40 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Work authorization
          </div>
          <div className="mt-1 text-sm font-medium">{auth ?? "Not confirmed"}</div>
        </div>
      </div>
    </SectionCard>
  );
});
