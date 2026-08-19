import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  Linkedin,
  Lock as LockIcon,

  MapPin,
} from "lucide-react";
import { DownloadCvButton } from "@/components/download-cv-button";
import { CvPreviewDialog } from "@/components/cv-preview-dialog";
import { CandidateScoreBadge } from "@/components/client/candidate-score-badge";
import { VisibilityNote } from "@/components/client/visibility-note";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";
import { formatEnumLabel } from "@/lib/human-labels";
import { formatDateTime } from "@/lib/format/datetime";

export function BackLink() {
  return (
    <Link
      to="/client/candidates"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      All candidates
    </Link>
  );
}

export function CandidateHeader({
  candidate,
  readOnly,
}: {
  candidate: ClientCandidateDTO;
  readOnly: boolean;
}) {
  const c = candidate.candidate;
  return (
    <header className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {c.display_name}
          </h1>
          <CandidateScoreBadge
            score={candidate.score}
            fitLabel={candidate.fit_label}
            evidence={candidate.evidence_support}
            rechecking={candidate.freshness?.state === "stale"}
            humanReviewed={candidate.human_review?.reviewed === true}
            evidencePending={candidate.explanation?.kind === "evidence_pending"}
            unicorn={candidate.unicorn}
          />
          <Badge variant="outline" className="capitalize">
            {formatEnumLabel(candidate.stage)}
          </Badge>
        </div>
        {c.headline && (
          <p className="mt-1 text-base text-muted-foreground">
            {c.headline}
          </p>
        )}
        {candidate.explanation?.kind === "evidence_pending" ? (
          <p className="mt-1 text-sm text-muted-foreground italic">
            {candidate.explanation.headline} — {candidate.explanation.summary}
          </p>
        ) : null}
        {candidate.human_review?.statement && (
          <p className="mt-1 text-sm text-primary">{candidate.human_review.statement}</p>
        )}
        {c.headline_chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.headline_chips.map((chip) => (
              <Badge key={chip} variant="secondary" className="font-normal">
                {chip}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {candidate.position && (
            <Link
              to="/client/positions/$id"
              params={{ id: candidate.position.id }}
              className="inline-flex items-center gap-1 text-foreground hover:underline"
            >
              <Briefcase className="h-3.5 w-3.5" aria-hidden />
              {candidate.position.title}
            </Link>
          )}
          {(c.current_role || c.current_company) && (
            <span>
              {[c.current_role, c.current_company].filter(Boolean).join(" @ ")}
            </span>
          )}
          {c.years_experience != null && (
            <span>{c.years_experience}+ yrs experience</span>
          )}
          {c.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {c.location}
            </span>
          )}
          {(c.timezone || c.availability) && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {[c.timezone, c.availability].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
        {candidate.last_updated && (
          <p className="mt-2 text-xs text-muted-foreground">
            Last updated {formatDateTime(candidate.last_updated)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {readOnly && (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Preview
          </Badge>
        )}
      </div>
      <VisibilityNote className="col-span-full mt-3" />
    </header>
  );
}

/**
 * The one contact surface on this page: identity contact details plus exactly
 * one CV preview and one CV download control.
 */
export function ContactBlock({ candidate }: { candidate: ClientCandidateDTO }) {
  const c = candidate.candidate;
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Email", value: c.email ? <a className="text-primary hover:underline" href={`mailto:${c.email}`}>{c.email}</a> : null },
    { label: "Phone", value: c.phone ? <a className="text-primary hover:underline" href={`tel:${c.phone}`}>{c.phone}</a> : null },
    {
      label: "LinkedIn",
      value: c.links.linkedin ? (
        <a
          href={c.links.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          aria-label={`Open LinkedIn profile for ${c.display_name} (opens in new tab)`}
        >
          <Linkedin className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          View profile
          <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden />
        </a>
      ) : null,
    },
    { label: "Location", value: c.location ?? null },
    { label: "Work authorization", value: candidate.work_authorization ?? "Not provided" },
  ];

  return (
    <section aria-labelledby="contact-heading" className="rounded-xl border bg-card p-4">
      <h2 id="contact-heading" className="text-sm font-semibold">
        Contact
      </h2>
      <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 truncate">
              {r.value || <span className="text-muted-foreground">Not provided</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {candidate.contact_released ? (
          <>
            <CvPreviewDialog matchId={candidate.match_id} candidateName={c.display_name} />
            <DownloadCvButton matchId={candidate.match_id} mode="download" />
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
            <LockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Contact details and CV are released as soon as a candidate is published.
          </span>
        )}
      </div>
    </section>
  );
}


export function SectionCard({
  title,
  icon,
  description,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby={`sec-${title}`}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`sec-${title}`} className="flex items-center gap-2 text-sm font-semibold">
            {icon}
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "emerald" | "amber" | "slate" | "sky";
}) {
  const bg = {
    emerald: "taas-bg-success-soft taas-fg-success ",
    amber: "taas-bg-warning-soft taas-fg-warning ",
    slate: "taas-bg-neutral-soft taas-fg-neutral ",
    sky: "taas-bg-info-soft taas-fg-info ",
  }[tone];
  return (
    <div className="rounded-md border p-3">
      <div className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", bg)}>
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function JumpNav({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <nav
      aria-label="Section navigation"
      className="sticky top-14 z-20 -mx-4 overflow-x-auto border-y bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:mx-0 sm:rounded-lg sm:border"
    >
      <ul className="flex items-center gap-1 whitespace-nowrap text-xs">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className="inline-flex min-h-11 items-center rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-0 sm:px-2.5"
            >
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Collapsed-by-default detail block. The first screen stays high level; the
 * deep evidence lives behind these dropdowns further down the page.
 */
export function CollapsibleSection({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group scroll-mt-24 rounded-xl border bg-card [&_section]:border-0 [&_section]:bg-transparent [&_section]:p-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <span className="min-w-0">
          <span className="text-sm font-semibold">{title}</span>
          {summary && (
            <span className="ml-2 text-xs text-muted-foreground">{summary}</span>
          )}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t px-4 py-4 sm:px-5">{children}</div>
    </details>
  );
}
