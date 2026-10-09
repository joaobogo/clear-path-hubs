import { Link } from "@tanstack/react-router";
import { RoleInput } from "@/components/system/role-input";
import { CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import { offer } from "@/config/offer";

/**
 * Closing band (The Run): the solid blue band that ends every marketing
 * page. "Run your role.", the role input at its largest, three facts, and
 * the pilot and message links. It replaces the old sticky pilot bar.
 */
export function ClosingBand({ role = "", source = "closing_band" }: { role?: string; source?: string }) {
  const facts = [
    `One role, run end to end.`,
    `Up to ${offer.pilot.candidates} candidates, reviewed by a recruiter.`,
    `Usually ${offer.pilot.businessDays} business days from an approved brief.`,
  ];
  return (
    <section aria-labelledby="closing-band-title" className="blue">
      <div className="mx-auto w-full max-w-[calc(var(--max)+2*var(--margin))] px-[var(--margin)] py-20 sm:py-24">
        <h2
          id="closing-band-title"
          className="text-[44px] leading-[1.04] text-[color:var(--text)] sm:text-[60px] sm:leading-none"
        >
          Run your role.
        </h2>
        <ul className="mt-5 flex flex-col gap-1 text-lg text-[color:var(--text-2)] sm:flex-row sm:flex-wrap sm:gap-x-6">
          {facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="mt-10 max-w-[880px]">
          <RoleInput size="closing" defaultRole={role} source={source} className="border-transparent" />
        </div>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-base">
          <Link
            to={CTA_PRIMARY.to}
            className="inline-flex min-h-11 items-center font-semibold text-[color:var(--text)] underline underline-offset-4"
          >
            Or {CTA_PRIMARY.label.charAt(0).toLowerCase() + CTA_PRIMARY.label.slice(1)}
          </Link>
          <Link
            to={CTA_MESSAGE.to}
            className="inline-flex min-h-11 items-center text-[color:var(--text-2)] underline underline-offset-4 hover:text-[color:var(--text)]"
          >
            {CTA_MESSAGE.label}
          </Link>
        </p>
      </div>
    </section>
  );
}
