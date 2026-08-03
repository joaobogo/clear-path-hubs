import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { SiteShell } from "@/components/marketing/site-shell";
import { Markdown } from "@/components/marketing/markdown";
import type { ContentEntry } from "@/lib/marketing/content";

const LEGAL_REVIEW_TOPICS = [
  "Data controller and processor roles",
  "Candidate data collection and use",
  "CV processing and evidence extraction",
  "Analytics and product telemetry",
  "Consent capture and withdrawal",
  "Retention windows and deletion",
  "Notifications and messaging",
  "International processing and cross-border transfers",
];

const DESTINATION_ARCHITECTURE = [
  {
    role: "Application hosting",
    provider: "Cloudflare Workers",
    purpose: "Serverless edge runtime for the TaaSFlow web application.",
  },
  {
    role: "Backend, database, auth, storage, server functions",
    provider: "Supabase (managed Postgres platform)",
    purpose:
      "Postgres database, authentication, private storage buckets, realtime, and server-side functions.",
  },
  {
    role: "CV parsing and evidence scoring",
    provider: "Google (Gemini models, via TaaSFlow's managed AI gateway)",
    purpose:
      "Structured extraction of CV data and role-specific scoring signals used inside the workspace.",
  },
  {
    role: "Transactional and system email",
    provider: "TaaSFlow transactional email infrastructure",
    purpose: "Auth flows and application lifecycle notifications.",
  },
];

export function LegalPage({
  entry,
  fallbackTitle,
  fallbackDescription,
  extraNote,
}: {
  entry: ContentEntry | undefined;
  fallbackTitle: string;
  fallbackDescription?: string;
  extraNote?: ReactNode;
}) {
  const title = entry?.meta.h1 || entry?.meta.title || fallbackTitle;
  const description = entry?.meta.description || fallbackDescription;

  return (
    <SiteShell>
      <article className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-8 border-b border-border/60 pb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Legal
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 text-lg text-muted-foreground">{description}</p>
          ) : null}
        </header>

        <aside
          role="note"
          className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-50/50 p-5 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100"
        >
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Pending legal review</p>
              <p className="mt-1.5">
                This document was migrated from a prior version of the TaaSFlow
                site. The following areas must be reviewed by qualified counsel
                before this page is treated as final:
              </p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                {LEGAL_REVIEW_TOPICS.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Do not rely on this notice for legal certainty until review is
                complete. To request the current controller of record, contact{" "}
                <Link
                  to="/contact"
                  className="font-semibold underline underline-offset-2"
                >
                  the TaaSFlow team
                </Link>
                .
              </p>
            </div>
          </div>
        </aside>

        <aside
          role="note"
          className="mb-10 rounded-2xl border border-border/60 bg-muted/30 p-5 text-sm"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary"
              aria-hidden
            />
            <div className="w-full">
              <p className="font-semibold text-foreground">
                Destination architecture note
              </p>
              <p className="mt-1.5 text-muted-foreground">
                The current TaaSFlow deployment is powered by the following
                platforms. Where the legal text below references legacy
                providers, treat this table as the authoritative record of the
                current processing environment pending legal review.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Role</th>
                      <th className="py-2 pr-3 font-semibold">Provider</th>
                      <th className="py-2 font-semibold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DESTINATION_ARCHITECTURE.map((row) => (
                      <tr key={row.role} className="border-b border-border/40">
                        <td className="py-2 pr-3 align-top font-medium text-foreground">
                          {row.role}
                        </td>
                        <td className="py-2 pr-3 align-top text-foreground">
                          {row.provider}
                        </td>
                        <td className="py-2 align-top text-muted-foreground">
                          {row.purpose}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {extraNote ? (
                <div className="mt-3 text-xs text-muted-foreground">
                  {extraNote}
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {entry ? (
          <Markdown>{entry.markdown}</Markdown>
        ) : (
          <p className="text-muted-foreground">
            The full legal text is being finalized. Contact the TaaSFlow team
            for the current version of this document.
          </p>
        )}
      </article>
    </SiteShell>
  );
}
