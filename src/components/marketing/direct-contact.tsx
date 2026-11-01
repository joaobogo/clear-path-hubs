import { Linkedin, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIRECT_CONTACTS,
  DIRECT_CONTACT_EMAIL,
  directContactMailto,
} from "@/config/direct-contact";

/** The address with a soft break after "@", so narrow boxes break it cleanly. */
export function EmailText({ email = DIRECT_CONTACT_EMAIL }: { email?: string }) {
  const at = email.indexOf("@");
  if (at < 0) return <>{email}</>;
  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}

/**
 * "Talk to us directly": the founders' LinkedIn profiles and the direct inbox.
 * Shown wherever a visitor might otherwise rely on a form or a shared address
 * (contact page, form confirmations and failures, the site footer).
 */
export function DirectContactCard({
  title = "Talk to us directly",
  description = "Message John or Christian on LinkedIn, or email John. A person reads every message.",
  subject,
  headingLevel = 2,
  className,
}: {
  title?: string;
  /** Heading level for the card title; use 3 inside a page section that already has an h2. */
  headingLevel?: 2 | 3;
  description?: string;
  /** Pre-filled email subject, e.g. a submission reference. */
  subject?: string;
  className?: string;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5 sm:p-6",
        className,
      )}
    >
      <Heading className="font-[family-name:var(--brand-font-display)] text-lg font-semibold tracking-tight text-[color:var(--brand-navy)]">
        {title}
      </Heading>
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
      <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70 [overflow-wrap:anywhere]">
        <a className="underline underline-offset-4" href={directContactMailto(subject)}>
          <EmailText />
        </a>
      </p>
    </section>
  );
}

/** One-line version for tight spots: "john@… · John on LinkedIn · Christian on LinkedIn". */
export function DirectContactLine({
  subject,
  showEmail = true,
  className,
}: {
  subject?: string;
  /** False when the caller already shows the address next to this line. */
  showEmail?: boolean;
  className?: string;
}) {
  const link = "inline-flex items-center underline underline-offset-4";
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 gap-y-0", className)}>
      {showEmail ? (
        <a className={cn(link, "[overflow-wrap:anywhere]")} href={directContactMailto(subject)}>
          <span>
            <EmailText />
          </span>
        </a>
      ) : null}
      {DIRECT_CONTACTS.map((person) => (
        <a
          key={person.name}
          className={link}
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
