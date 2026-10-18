import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { getIndustryHeroImage } from "@/content/industry-hero-images";
import { HeroPicture } from "@/components/marketing/hero-picture";

/**
 * "Any role, any sector": shows right after the hero so the healthcare
 * example in the hero never reads as the only thing we hire for.
 */
const SECTORS = [
  { slug: "hospitality", label: "Hospitality", roles: "Hotel managers · Front desk · Chefs" },
  { slug: "logistics", label: "Warehouse & logistics", roles: "Supervisors · Forklift · Dispatch" },
  { slug: "healthcare", label: "Healthcare", roles: "Nurses · Medical assistants · Admin" },
  { slug: "retail", label: "Retail", roles: "Store managers · Associates · Merchandising" },
  { slug: "tech", label: "Technology", roles: "Engineers · Product · Data" },
  { slug: "finance", label: "Finance & office", roles: "Accountants · Analysts · Sales" },
] as const;

export function SectorBand() {
  return (
    <section aria-labelledby="sector-band-title" className="day">
      <div className="mx-auto w-full max-w-[calc(var(--max)+2*var(--margin))] px-[var(--margin)] py-16 sm:py-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="sector-band-title" className="text-[32px] leading-[1.08] text-[color:var(--ink)] sm:text-[44px]">
              Any role. Any sector.
            </h2>
            <p className="mt-3 max-w-[560px] text-[17px] text-[color:var(--slate)]">
              From the front desk to the warehouse floor to the engineering team.
            </p>
          </div>
          <Link to="/industries" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[color:var(--blue-600)]">
            All industries <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {SECTORS.map((s) => {
            const img = getIndustryHeroImage(s.slug);
            return (
              <li key={s.slug}>
                <Link
                  to="/industries/$slug"
                  params={{ slug: s.slug }}
                  className="group block overflow-hidden rounded-[var(--r-3)] border border-[color:var(--rule-2)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)]"
                >
                  {img ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <HeroPicture
                        src={img.src}
                        alt={img.alt}
                        width={img.width}
                        height={img.height}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                    </div>
                  ) : null}
                  <div className="p-4 sm:p-5">
                    <p className="text-base font-semibold text-[color:var(--ink)]">{s.label}</p>
                    <p className="mt-1 text-sm text-[color:var(--slate)]">{s.roles}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
