import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA } from "@/config/public-navigation";

type CtaProps = {
  to?: string;
  href?: string;
  label: string;
  onClick?: () => void;
  className?: string;
};

/** Primary + secondary side-by-side, used in hero and section-close blocks. */
export function HeroCTAGroup({
  primary,
  secondary,
  className,
}: {
  primary?: CtaProps;
  secondary?: CtaProps;
  className?: string;
}) {
  const p = primary ?? { to: PRIMARY_CTA.to, label: PRIMARY_CTA.label };
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <PrimaryButton {...p} />
      {secondary ? <GhostButton {...secondary} /> : null}
    </div>
  );
}

export function InlineCTA({ to, href, label, onClick, className }: CtaProps) {
  return <PrimaryButton to={to} href={href} label={label} onClick={onClick} className={className} />;
}

export function SectionCTA({
  eyebrow,
  title,
  description,
  primary,
  secondary,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  primary?: CtaProps;
  secondary?: CtaProps;
}) {
  return (
    <section className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-8 sm:p-12">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/60">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)] sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-base text-[color:var(--brand-navy)]/70">
          {description}
        </p>
      ) : null}
      <HeroCTAGroup primary={primary} secondary={secondary} className="mt-6" />
    </section>
  );
}

export function FinalCTASection({
  title,
  description,
  primary,
  secondary,
}: {
  title: string;
  description?: string;
  primary?: CtaProps;
  secondary?: CtaProps;
}) {
  return (
    <section className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-[color:var(--brand-navy)] px-6 py-14 text-center text-white sm:px-12">
        <h2 className="mx-auto max-w-2xl font-[family-name:var(--brand-font-display)] text-3xl font-semibold sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="mx-auto mt-4 max-w-xl text-base text-white/80">{description}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <InvertedPrimaryButton {...(primary ?? { to: PRIMARY_CTA.to, label: PRIMARY_CTA.label })} />
          {secondary ? <InvertedGhostButton {...secondary} /> : null}
        </div>
      </div>
    </section>
  );
}

export function TextLinkCTA({ to, href, label, className }: CtaProps) {
  const inner = (
    <span className="inline-flex items-center gap-1 font-medium text-[color:var(--brand-navy)] hover:underline">
      {label} <ArrowRight className="h-4 w-4" aria-hidden />
    </span>
  );
  if (href) {
    const external = /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className={cn("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]", className)}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inner}
        {external ? <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden /> : null}
      </a>
    );
  }
  return (
    <Link to={to ?? "/"} className={cn("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]", className)}>
      {inner}
    </Link>
  );
}

export function EmployerCTA({ label = "Start hiring" }: { label?: string }) {
  return <PrimaryButton to="/intake" label={label} />;
}

export function CandidateCTA({ label = "Browse jobs" }: { label?: string }) {
  return <GhostButton to="/jobs" label={label} />;
}

/* ------------------------------------------------------------- primitives */

function PrimaryButton({ to, href, label, onClick, className }: CtaProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--brand-navy-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]";
  return renderCta({ to, href, label, onClick, className: cn(base, className) });
}

function GhostButton({ to, href, label, onClick, className }: CtaProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/15 bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]";
  return renderCta({ to, href, label, onClick, className: cn(base, className) });
}

function InvertedPrimaryButton({ to, href, label, onClick, className }: CtaProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
  return renderCta({ to, href, label, onClick, className: cn(base, className) });
}

function InvertedGhostButton({ to, href, label, onClick, className }: CtaProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";
  return renderCta({ to, href, label, onClick, className: cn(base, className) });
}

function renderCta({
  to,
  href,
  label,
  onClick,
  className,
}: CtaProps): ReactNode {
  if (href) {
    const external = /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        onClick={onClick}
        className={className}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>
    );
  }
  return (
    <Link to={to ?? "/"} onClick={onClick} className={className}>
      {label}
    </Link>
  );
}
