import { Linkedin, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIRECT_CONTACTS,
  DIRECT_CONTACT_EMAIL,
  directContactMailto,
} from "@/config/direct-contact";

/**
 * "Talk to us directly": the founders' LinkedIn profiles and the direct inbox.
 * Shown wherever a visitor might otherwise rely on a form or a shared address
 * (contact page, form confirmations and failures, the site footer).
 */
export function DirectContactCard({
  title = "Talk to us directly",
  description = "Message John or Christian on LinkedIn, or email John. A person reads every message.",
  subject,
  className,
}: {
  title?: string;
  description?: string;
  /** Pre-filled email subject, e.g. a submission reference. */
  subject?: string;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 sm:p-6",
        className,
      )}
    >
      <h2 className="font-[family-name:var(--brand-font-display)] text-lg font-semibold tracking-tight text-[color:var(--brand-navy)]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[color:var(--brand-navy)]/80">{description}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {DIRECT_CONTACTS.map((person) => (
          <li
            key={person.name}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-[color:var(--brand-navy)]/10 p-4"
          >
            <div className="min-w-0">
              <p className="font-semibold text-[color:var(--brand-navy)]">{person.name}</p>
              <p className="text-sm text-[color:var(--brand-navy)]/70">{person.role}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={person.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${person.name} on LinkedIn (opens in a new tab)`}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[color:var(--blue-600)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                <Linkedin className="h-4 w-4" aria-hidden />
                LinkedIn
              </a>
              {person.email ? (
                <a
                  href={directContactMailto(subject)}
                  aria-label={`Email ${person.name}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[color:var(--brand-navy)]/20 px-4 py-2 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  Email
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 break-all text-sm text-[color:var(--brand-navy)]/70">
        <a className="underline underline-offset-4" href={directContactMailto(subject)}>
          {DIRECT_CONTACT_EMAIL}
        </a>
      </p>
    </section>
  );
}

/** One-line version for tight spots: "Email john@… · John on LinkedIn · Christian on LinkedIn". */
export function DirectContactLine({
  subject,
  className,
}: {
  subject?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <a className="underline underline-offset-4 break-all" href={directContactMailto(subject)}>
        {DIRECT_CONTACT_EMAIL}
      </a>
      {DIRECT_CONTACTS.map((person) => (
        <a
          key={person.name}
          className="underline underline-offset-4"
          href={person.linkedin}
          target="_blank"
          rel="noopener noreferrer"
        >
          {person.name.split(" ")[0]} on LinkedIn
        </a>
      ))}
    </span>
  );
}
