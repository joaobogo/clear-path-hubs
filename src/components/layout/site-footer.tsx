import { Link } from "@tanstack/react-router";
import { ConsentPreferencesLink } from "@/components/analytics/consent-banner";
import { EcosystemFooterRow } from "@/components/marketing/ecosystem-footer-row";
import { BrandMark } from "@/components/layout/brand-mark";
import {
  FOOTER_DESCRIPTION,
  FOOTER_GROUPS,
  SOCIAL_LINKS,
  type NavLink,
} from "@/config/public-navigation";

const footLink =
  "inline-flex min-h-11 items-center text-[15px] text-[color:var(--slate)] hover:text-[color:var(--blue-600)] hover:underline underline-offset-4";

function FooterLink({ link }: { link: NavLink }) {
  return link.external ? (
    <a href={link.to} className={footLink}>
      {link.label}
    </a>
  ) : (
    <Link to={link.to} hash={link.hash} className={footLink}>
      {link.label}
    </Link>
  );
}

/**
 * Footer (The Run). White. Five columns (brand, Product, Buying, Proof,
 * Candidates) and one legal row. Nothing below it, no sticky bar above it.
 */
export function SiteFooter() {
  const legal = FOOTER_GROUPS.find((g) => g.label === "Legal");
  const columns = FOOTER_GROUPS.filter((g) => g.label !== "Legal");

  return (
    <footer className="day border-t border-[color:var(--rule)]">
      <div className="mx-auto w-full max-w-[calc(var(--max)+2*var(--margin))] px-[var(--margin)] pb-8 pt-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <BrandMark lazy />
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-[color:var(--slate)]">
              {FOOTER_DESCRIPTION}
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5">
              {SOCIAL_LINKS.map(({ href, label }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" className={footLink}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <h2 className="text-[13px] font-medium text-[color:var(--faint)] [font-stretch:88%] [letter-spacing:0]">
                {group.label}
              </h2>
              <ul className="mt-3">
                {group.links
                  .filter((l) => !l.hidden)
                  .map((l) => (
                    <li key={`${l.to}-${l.label}`}>
                      <FooterLink link={l} />
                    </li>
                  ))}
              </ul>
            </nav>
          ))}
        </div>

        <EcosystemFooterRow />

        <div className="mt-10 flex flex-col gap-2 border-t border-[color:var(--rule)] pt-6 text-sm text-[color:var(--faint)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TaaSFlow. All rights reserved.</p>
          {legal ? (
            <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5">
              {legal.links
                .filter((l) => !l.hidden)
                .map((l) => (
                  <FooterLink key={l.label} link={l} />
                ))}
              <ConsentPreferencesLink className={footLink} />
              <a href="mailto:hello@taasflow.com" className={footLink}>
                hello@taasflow.com
              </a>
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
