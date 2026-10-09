import { useMemo, useState } from "react";
import type { IndustryEntry, IndustryRoleFamily } from "@/content/industries-v2";
import { getRoleEvidence } from "@/content/industry-evidence-bank";
import { CTA_HOW_IT_WORKS, CTA_PRIMARY } from "@/config/cta";
import { FIRST_SHORTLIST_TIMING_SHORT } from "@/config/offer-facts";

/**
 * Interactive role explorer. Two axes of selection:
 *   1. Role family (left rail) — narrows the scope.
 *   2. Individual role (chip row) — every displayed panel field is
 *      recomputed from the selected role name using deterministic
 *      seniority + function heuristics so no two roles read the same.
 *
 * All copy is presentational — nothing here reads production candidate data.
 */
export function IndustryRoleExplorer({ entry }: { entry: IndustryEntry }) {
  const families: IndustryRoleFamily[] = useMemo(
    () =>
      entry.roleFamilies && entry.roleFamilies.length > 0
        ? entry.roleFamilies
        : [
            {
              name: `${entry.name} roles`,
              blurb: `Roles TaaSFlow sources in ${entry.name}.`,
              roles: entry.roles,
            },
          ],
    [entry],
  );

  const [famIdx, setFamIdx] = useState(0);
  const [roleIdx, setRoleIdx] = useState(0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      {/* Family rail */}
      <div
        role="tablist"
        aria-label={`${entry.name} role families`}
        className="flex flex-col gap-2"
      >
        {families.map((fam, idx) => {
          const selected = idx === famIdx;
          return (
            <button
              key={fam.name}
              role="tab"
              aria-selected={selected}
              aria-controls={`role-family-panel-${idx}`}
              onClick={() => {
                setFamIdx(idx);
                setRoleIdx(0);
              }}
              className={[
                "min-h-11 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                selected
                  ? "border-[color:var(--brand-ocean)] bg-[color:var(--brand-ocean)]/10 text-[color:var(--brand-navy)]"
                  : "border-[color:var(--brand-navy)]/10 bg-white text-[color:var(--brand-navy)]/85 hover:border-[color:var(--brand-ocean)]/40",
              ].join(" ")}
            >
              <span className="block font-semibold">{fam.name}</span>
              {fam.blurb ? (
                <span className="mt-1 block text-xs text-[color:var(--brand-navy)]/80">
                  {fam.blurb}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Panels: every family and role is in the HTML; inactive ones are hidden. */}
      {families.map((fam, fIdx) => (
        <div
          key={fam.name}
          id={`role-family-panel-${fIdx}`}
          role="tabpanel"
          aria-label={fam.name}
          hidden={fIdx !== famIdx}
          className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6"
        >
          {/* Role chips */}
          <div
            role="tablist"
            aria-label={`${fam.name} — individual roles`}
            className="flex flex-wrap gap-2"
          >
            {fam.roles.map((r, idx) => {
              const selected = idx === Math.min(roleIdx, fam.roles.length - 1);
              return (
                <button
                  key={r}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`role-panel-${fIdx}-${idx}`}
                  onClick={() => setRoleIdx(idx)}
                  className={[
                    "inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-xs font-medium sm:min-h-9 transition-colors",
                    selected
                      ? "border-[color:var(--brand-navy)] bg-[color:var(--blue-600)] text-white"
                      : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-navy)]/40",
                  ].join(" ")}
                >
                  {r}
                </button>
              );
            })}
          </div>

          {fam.roles.map((r, idx) => (
            <RolePanel
              key={r}
              id={`role-panel-${fIdx}-${idx}`}
              hidden={idx !== Math.min(roleIdx, fam.roles.length - 1)}
              role={r}
              family={fam}
              entry={entry}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function RolePanel({
  id,
  hidden,
  role,
  family,
  entry,
}: {
  id: string;
  hidden: boolean;
  role: string;
  family: IndustryRoleFamily;
  entry: IndustryEntry;
}) {
  const view = useMemo(() => buildRoleView(role, family, entry), [role, family, entry]);
  return (
    <div id={id} role="tabpanel" aria-label={role} hidden={hidden}>
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-t border-[color:var(--brand-navy)]/10 pt-5">
          <div>
            <h3 className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
              {role}
            </h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
              {view.seniority} · {family.name} · {entry.name}
            </p>
          </div>
        </div>

        <p className="mt-3 max-w-3xl text-sm text-[color:var(--brand-navy)]/80">
          {view.summary}
        </p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <ExplorerBlock title="Common requirements" items={view.requirements} />
          <ExplorerBlock title="Candidate signals we score" items={view.signals} />
          <ExplorerBlock title="Relevant skills" items={view.skills} />
          <ExplorerBlock title="Likely validation areas" items={view.validation} />
          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Sample evidence line
            </p>
            <blockquote className="mt-2 rounded-xl bg-[color:var(--brand-mist)]/60 p-4 text-sm italic text-[color:var(--brand-navy)]/85">
              {view.evidence}
              <footer className="mt-2 not-italic text-xs text-[color:var(--brand-navy)]/80">
                Illustrative example, not a quote from a real candidate.
              </footer>
            </blockquote>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[color:var(--brand-navy)]/10 pt-5">
          <p className="text-sm text-[color:var(--brand-navy)]/80">{view.cta}</p>
          <a
            href={CTA_PRIMARY.to}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[color:var(--blue-600)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            {CTA_PRIMARY.label}
          </a>
          <a
            href={CTA_HOW_IT_WORKS.to}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[color:var(--brand-navy)]/20 px-4 py-2 text-sm font-semibold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
          >
            {CTA_HOW_IT_WORKS.label}
          </a>
        </div>
    </div>
  );
}

function ExplorerBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--brand-navy)]/85">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span
              aria-hidden
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-ocean)]"
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------- deterministic per-role view builders -------- */

type Seniority = "Junior" | "Mid" | "Senior" | "Lead" | "Manager" | "Director" | "Executive";

type RoleFunction =
  | "engineering"
  | "product"
  | "design"
  | "data"
  | "security"
  | "devops"
  | "sales"
  | "marketing"
  | "customer"
  | "finance"
  | "legal"
  | "clinical"
  | "operations"
  | "hr"
  | "generic";

function detectSeniority(role: string): Seniority {
  const r = role.toLowerCase();
  if (/(chief|c[toefpm]o|founder|vp|vice president|head of|partner)/.test(r)) return "Executive";
  if (/director/.test(r)) return "Director";
  if (/(manager|principal)/.test(r)) return "Manager";
  if (/(lead|staff)/.test(r)) return "Lead";
  if (/(senior|sr\b|sr\.)/.test(r)) return "Senior";
  if (/(junior|jr\b|associate|entry)/.test(r)) return "Junior";
  return "Mid";
}

function detectFunction(role: string): RoleFunction {
  const r = role.toLowerCase();
  if (/(engineer|developer|programmer|swe|sde|architect|full[- ]?stack|backend|frontend)/.test(r)) return "engineering";
  if (/(product manager|pm\b|product owner|product lead)/.test(r)) return "product";
  if (/(designer|ux|ui|research)/.test(r)) return "design";
  if (/(data|analyt|analyst|scientist|ml|machine learning|ai\b|bi\b)/.test(r)) return "data";
  if (/(security|secops|iam|grc|pentest|soc analyst|threat)/.test(r)) return "security";
  if (/(devops|sre|platform|reliability|infrastructure)/.test(r)) return "devops";
  if (/(sales|account executive|ae\b|sdr|bdr|revenue)/.test(r)) return "sales";
  if (/(marketing|growth|brand|content|seo|demand)/.test(r)) return "marketing";
  if (/(customer|success|support|csm\b)/.test(r)) return "customer";
  if (/(finance|accountant|controller|treasury|audit|fp&a|cfo)/.test(r)) return "finance";
  if (/(legal|counsel|lawyer|attorney|paralegal|compliance officer)/.test(r)) return "legal";
  if (/(nurse|physician|clinician|doctor|md\b|surgeon|therapist|pharmacist|radiolog|clinical)/.test(r)) return "clinical";
  if (/(operations|ops|logistic|supply|procure|project manager|construction|site|foreman|superintendent)/.test(r)) return "operations";
  if (/(recruit|talent|people|hr\b|human resources)/.test(r)) return "hr";
  return "generic";
}

function buildRoleView(role: string, family: IndustryRoleFamily, entry: IndustryEntry) {
  const seniority = detectSeniority(role);
  const fn = detectFunction(role);

  const summary = buildSummary(role, seniority, fn, entry);
  const requirements = buildRequirements(seniority, fn, entry);
  const signals = buildSignals(fn, entry);
  const skills = buildSkills(fn, entry);
  const validation = buildValidation(fn, entry);
  const evidence = buildEvidence(role, seniority, fn, entry);
  const cta = buildCta(role, seniority);

  return { seniority, summary, requirements, signals, skills, validation, evidence, cta };
}

function buildSummary(role: string, sen: Seniority, fn: RoleFunction, entry: IndustryEntry): string {
  const scope: Record<Seniority, string> = {
    Junior: "executes scoped work under structured supervision",
    Mid: "owns delivery of individual tracks end to end",
    Senior: "sets technical direction and mentors peers",
    Lead: "leads a squad's delivery and cross-team coordination",
    Manager: "owns a team's outcomes, hiring and roadmap",
    Director: "runs a multi-team function against business targets",
    Executive: "owns the function at the leadership table with P&L accountability",
  };
  const fnDescriptor: Record<RoleFunction, string> = {
    engineering: "shipping production software",
    product: "translating discovery into shipped roadmap",
    design: "shaping the experience customers judge you on",
    data: "turning warehouse data into decisions",
    security: "protecting systems and defending the audit trail",
    devops: "keeping the platform reliable, safe and fast",
    sales: "carrying revenue against a defined territory or motion",
    marketing: "building pipeline that survives sales scrutiny",
    customer: "protecting retention and expansion post-sale",
    finance: "closing the books and defending the numbers",
    legal: "advising the business on risk with jurisdictional precision",
    clinical: "delivering patient care against evidence-based protocols",
    operations: "running the day-to-day physical and process operation",
    hr: "matching talent to seats without waste",
    generic: `delivering ${entry.name.toLowerCase()} outcomes end to end`,
  };
  return `A ${role} at TaaSFlow is a ${sen.toLowerCase()} operator who ${scope[sen]} — focused on ${fnDescriptor[fn]} inside a ${entry.name.toLowerCase()} context.`;
}

function buildRequirements(sen: Seniority, fn: RoleFunction, entry: IndustryEntry): string[] {
  const years: Record<Seniority, string> = {
    Junior: "0–2 years",
    Mid: "2–5 years",
    Senior: "5–8 years",
    Lead: "7–10 years including squad leadership",
    Manager: "8–12 years with 2+ years managing a team",
    Director: "12+ years with multi-team ownership",
    Executive: "15+ years with function-level accountability",
  };
  const fnReq: Record<RoleFunction, string> = {
    engineering: "Production code shipped in the target stack, not just tutorials",
    product: "Shipped roadmap with measurable outcome, not backlog grooming",
    design: "Case studies with problem, decisions and after-metrics",
    data: "Pipelines or models in production, with owners and SLAs",
    security: "Documented control ownership and incident response",
    devops: "On-call ownership of a real production platform",
    sales: "Quota history with attainment percentage, not just OTE",
    marketing: "Campaign attribution to pipeline, not vanity impressions",
    customer: "Retention and expansion numbers per book of business",
    finance: "Ownership of a close, forecast or audit cycle",
    legal: "Named on transactions or matters, with jurisdiction stated",
    clinical: "Active licence, caseload volume and clinical setting",
    operations: "Named on projects with scope, budget and delivery scale",
    hr: "Requisitions closed with time-to-fill and quality-of-hire metrics",
    generic: `Direct ${entry.name.toLowerCase()} experience at comparable seniority`,
  };
  return [
    `${years[sen]} of relevant experience`,
    fnReq[fn],
    entry.regulatedRequirements?.[0]
      ? `Compliance with ${entry.regulatedRequirements[0]}`
      : `Domain fluency for ${entry.name}`,
    "Right to work confirmed for the target market",
  ];
}

function buildSignals(fn: RoleFunction, entry: IndustryEntry): string[] {
  const own = (entry.candidateSignals ?? []).map((s) => s.title);
  const fnSignals: Record<RoleFunction, string[]> = {
    engineering: ["Years of production stack use", "System-design ownership", "Code review depth"],
    product: ["Outcomes attributed", "Discovery evidence", "Cross-functional traction"],
    design: ["Portfolio depth", "Research rigour", "Systems thinking"],
    data: ["Pipeline ownership", "Model lifecycle", "Stakeholder impact"],
    security: ["Control ownership", "Incident history", "Framework fluency"],
    devops: ["SLO ownership", "IaC surface area", "Incident postmortems"],
    sales: ["Quota attainment", "Deal complexity", "Ramp curve"],
    marketing: ["Pipeline sourced", "Channel mastery", "Attribution rigour"],
    customer: ["NRR / GRR ownership", "Book size", "Playbook depth"],
    finance: ["Close ownership", "Audit exposure", "Forecast accuracy"],
    legal: ["Jurisdiction fluency", "Matter type coverage", "Bar / licence status"],
    clinical: ["Licensure status", "Caseload volume", "Practice setting fit"],
    operations: ["Project scale", "Safety record", "Delivery methodology"],
    hr: ["Requisition throughput", "Quality-of-hire", "Employer-brand levers"],
    generic: ["Relevant experience", "Documented achievements", "Domain fluency"],
  };
  return dedupe([...fnSignals[fn], ...own]).slice(0, 5);
}

function buildSkills(fn: RoleFunction, entry: IndustryEntry): string[] {
  const own = (entry.skills ?? []).slice(0, 4);
  const fnSkills: Record<RoleFunction, string[]> = {
    engineering: ["System design", "Testing & CI/CD"],
    product: ["Discovery frameworks", "Prioritisation"],
    design: ["Interaction design", "User research"],
    data: ["SQL / warehousing", "Modelling & experimentation"],
    security: ["Threat modelling", "Control frameworks"],
    devops: ["IaC & observability", "Incident response"],
    sales: ["MEDDICC / discovery", "Forecasting"],
    marketing: ["Positioning", "Demand attribution"],
    customer: ["Health scoring", "Expansion playbooks"],
    finance: ["Close cycle", "Forecast modelling"],
    legal: ["Contract drafting", "Regulatory research"],
    clinical: ["Patient assessment", "Protocol adherence"],
    operations: ["Project management", "Vendor / subcontractor ownership"],
    hr: ["Sourcing methodology", "Structured interviewing"],
    generic: ["Domain expertise", "Written communication"],
  };
  return dedupe([...own, ...fnSkills[fn]]).slice(0, 6);
}

function buildValidation(fn: RoleFunction, entry: IndustryEntry): string[] {
  const regulated = entry.regulatedRequirements ?? [];
  const certs = (entry.certifications ?? []).slice(0, 2);
  const fnValidation: Record<RoleFunction, string> = {
    engineering: "Stack claims cross-checked against project timelines",
    product: "Outcome claims cross-checked against release cadence",
    design: "Portfolio ownership vs. team credit line",
    data: "Model / pipeline claims cross-checked against tooling exposure",
    security: "Incident ownership vs. team-level attribution",
    devops: "On-call ownership vs. platform maturity",
    sales: "Quota vs. book segmentation",
    marketing: "Attribution vs. channel maturity",
    customer: "NRR ownership vs. book segmentation",
    finance: "Close ownership vs. team size",
    legal: "Bar / licence status and jurisdiction",
    clinical: "Active licence, DEA / registration where applicable",
    operations: "Project scale vs. named responsibility",
    hr: "Requisition throughput vs. team size",
    generic: "Ownership vs. team-level attribution",
  };
  const base = [fnValidation[fn], "Employment continuity and reason for change"];
  return dedupe([...base, ...regulated.slice(0, 1), ...certs]).slice(0, 4);
}

function buildEvidence(role: string, sen: Seniority, fn: RoleFunction, entry: IndustryEntry): string {
  // Illustrative evidence comes from this industry's own example bank —
  // never from a function-level template shared across verticals, which is
  // how the same sample quote used to appear on several industry pages.
  const banked = getRoleEvidence(entry.slug, fn);
  if (banked) {
    return sen === "Junior"
      ? `${banked} For an early-career hire we weight scope and receipts over years.`
      : banked;
  }
  return `For a ${role} in ${entry.name.toLowerCase()}, a CV scores on the work it names, its scope and who can confirm it — not on a keyword list.`;
}

function buildCta(role: string, _sen: Seniority): string {
  return `Hiring for ${role}? ${FIRST_SHORTLIST_TIMING_SHORT}.`;
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((x) => {
    const k = x.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
