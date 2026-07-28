import { useMemo, useState } from "react";
import type { IndustryEntry } from "@/content/industries-v2";

/**
 * Domain-aware candidate-signal explorer.
 *
 * Every industry maps to a "dimension pack" — a set of 5–6 evaluation axes
 * that are actually specific to that domain (technology: systems / scale /
 * architecture; finance: controls / compliance / modelling; healthcare:
 * licensing / caseload / setting; legal: jurisdiction / matter type / bar
 * status; construction: project type / safety / delivery scale). Selecting
 * a dimension updates the panel with an industry-specific description,
 * example red / green flags, and how TaaSFlow validates the signal.
 */

type Flag = { good: string; bad: string };
type Signal = {
  key: string;
  title: string;
  body: string;
  validation: string;
  flags: Flag;
};

type Pack = { label: string; signals: Signal[] };

export function IndustrySignalExplorer({ entry }: { entry: IndustryEntry }) {
  const pack: Pack = useMemo(() => resolvePack(entry), [entry]);

  const [activeIdx, setActiveIdx] = useState(0);
  const active = pack.signals[activeIdx];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
          {pack.label}
        </p>
        <p className="text-xs text-[color:var(--brand-navy)]/80">
          Dimensions specific to {entry.name} — not a generic checklist.
        </p>
      </div>

      <div
        role="tablist"
        aria-label={`${entry.name} evaluation dimensions`}
        className="flex flex-wrap gap-2"
      >
        {pack.signals.map((s, idx) => {
          const selected = idx === activeIdx;
          return (
            <button
              key={s.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveIdx(idx)}
              className={[
                "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                selected
                  ? "border-[color:var(--brand-ocean)] bg-[color:var(--brand-ocean)] text-white"
                  : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/80 hover:border-[color:var(--brand-ocean)]/40",
              ].join(" ")}
            >
              {s.title}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean-text)]">
            Dimension
          </p>
          <h3 className="mt-1 font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]">
            {active.title}
          </h3>
          <p className="mt-3 text-sm text-[color:var(--brand-navy)]/80">{active.body}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                Strong signal
              </p>
              <p className="mt-1.5 text-sm text-emerald-950/85">{active.flags.good}</p>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                Watch-out
              </p>
              <p className="mt-1.5 text-sm text-amber-950/85">{active.flags.bad}</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-[color:var(--brand-mist)]/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              How TaaSFlow validates
            </p>
            <p className="mt-2 text-sm text-[color:var(--brand-navy)]/80">{active.validation}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
            Other {entry.name} dimensions
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[color:var(--brand-navy)]/85">
            {pack.signals
              .map((s, idx) => ({ s, idx }))
              .filter(({ idx }) => idx !== activeIdx)
              .map(({ s, idx }) => (
                <li key={s.key} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand-navy)]/40"
                  />
                  <button
                    onClick={() => setActiveIdx(idx)}
                    className="text-left hover:text-[color:var(--brand-ocean-text)]"
                  >
                    {s.title}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* -------- dimension packs -------- */

function resolvePack(entry: IndustryEntry): Pack {
  const direct = DOMAIN_PACKS[entry.slug];
  if (direct) return direct;
  const family = FAMILY_MAP[entry.slug];
  if (family && DOMAIN_PACKS[family]) return DOMAIN_PACKS[family];
  return buildGenericPack(entry);
}

// Map niche slugs onto a parent family with a well-defined pack.
const FAMILY_MAP: Record<string, string> = {
  saas: "technology",
  "data-analytics": "technology",
  cybersecurity: "technology",
  "ai-ml": "technology",
  devops: "technology",
  tech: "technology",
  banking: "finance",
  insurance: "finance",
  fintech: "finance",
  "wealth-management": "finance",
  "private-equity": "finance",
  medical: "healthcare",
  pharma: "healthcare",
  biotech: "healthcare",
  "medical-devices": "healthcare",
  "law-firms": "legal",
  "in-house-legal": "legal",
  "civil-engineering": "construction",
  "commercial-construction": "construction",
  "residential-construction": "construction",
};

const DOMAIN_PACKS: Record<string, Pack> = {
  technology: {
    label: "What we evaluate in technology hires",
    signals: [
      {
        key: "systems",
        title: "Systems & stack depth",
        body: "Years of production use of the actual stack the role touches — languages, frameworks, cloud, database — separated cleanly from tools merely listed on the CV.",
        validation: "Every stack claim is cross-checked against project timelines and named systems on the CV; surface exposure never scores as production experience.",
        flags: {
          good: "6 years shipping Go/Postgres services on AWS with on-call ownership and named SLOs.",
          bad: "Long tool list with no matching project narrative or production timeline.",
        },
      },
      {
        key: "scale",
        title: "Scale & throughput",
        body: "The realistic scale the candidate has operated at — request rates, data volumes, team size — versus the scale the target role demands.",
        validation: "We match candidate-stated scale (e.g. events/day, MAUs, cluster size) to the role brief; overclaimed scale is flagged, not filtered silently.",
        flags: {
          good: "1.2M events/day and a documented incident postmortem attached.",
          bad: "'Web-scale' claims with no numbers, team size, or ownership scope.",
        },
      },
      {
        key: "architecture",
        title: "Architecture ownership",
        body: "Whether the candidate has led architecture decisions — designs authored, RFCs written, migrations owned — or was a downstream implementer.",
        validation: "We look for authored designs and named migrations, not just participation, and grade decision ownership vs. team credit.",
        flags: {
          good: "Authored the migration RFC and owned the rollout across three squads.",
          bad: "Listed as 'participant' on architectures with no design artefacts named.",
        },
      },
      {
        key: "reliability",
        title: "Reliability & on-call",
        body: "Real production ownership: SLOs, on-call rotations, and postmortems the candidate has authored or led.",
        validation: "On-call rotations and named platforms are validated against tenure and team size; 'exposure to SRE' does not count.",
        flags: {
          good: "Ran a 6-engineer on-call rota with p99 latency targets and three authored postmortems.",
          bad: "Mentions SRE culture but no rotation, no SLO, no incident history.",
        },
      },
      {
        key: "delivery",
        title: "Delivery pace",
        body: "Release cadence, PR throughput, and outcomes attributable to the candidate — not just team-level activity.",
        validation: "We attribute releases and outcomes to the candidate against the team size and repo history described.",
        flags: {
          good: "Named releases with measurable customer or platform impact.",
          bad: "Team achievements copy-pasted with no individual delivery evidence.",
        },
      },
    ],
  },
  finance: {
    label: "What we evaluate in finance hires",
    signals: [
      {
        key: "controls",
        title: "Controls ownership",
        body: "The controls the candidate has actually owned — SOX narratives, segregation-of-duties, revenue recognition — not just exposure through a large finance org.",
        validation: "Named controls are cross-checked against audit cycles, ERP systems and team size to confirm ownership vs. observation.",
        flags: {
          good: "Named owner of revenue-recognition controls through two clean audit cycles.",
          bad: "Long controls list with no audit cycle, ERP or team-size context.",
        },
      },
      {
        key: "compliance",
        title: "Regulatory & compliance fluency",
        body: "Concrete regulatory exposure — SOX, SOC 2, IFRS/US GAAP, Basel, Solvency II, MiFID II — matched to the exact target market and business model.",
        validation: "We verify jurisdictional scope, framework version and named filings; adjacent exposure is scored, not conflated with ownership.",
        flags: {
          good: "Led IFRS 15 revenue-recognition adoption across a EU SaaS entity.",
          bad: "Certifications listed without a matching engagement or filing.",
        },
      },
      {
        key: "modelling",
        title: "Modelling & forecasting rigour",
        body: "Forecast-accuracy history, three-statement modelling depth, and stress-testing exposure vs. templated FP&A output.",
        validation: "Forecast-accuracy claims are checked against tenure and reforecast cycles; template use vs. authored models is called out.",
        flags: {
          good: "Owned quarterly reforecast for a $180M ARR SaaS entity with ±3% accuracy.",
          bad: "Excel models named but no accuracy history and no reforecast cadence.",
        },
      },
      {
        key: "close",
        title: "Close ownership",
        body: "Monthly / quarterly close ownership — cycle days, material adjustments, and audit exposure — proportionate to team size and business complexity.",
        validation: "Close-cycle claims are matched against ERP, headcount and audit-firm exposure to confirm ownership vs. participation.",
        flags: {
          good: "Owns a 6-day close for a 240-person SaaS entity across NetSuite and Xero.",
          bad: "Close mentioned without cycle days, ERP or auditor context.",
        },
      },
      {
        key: "risk",
        title: "Risk & audit exposure",
        body: "Direct exposure to internal audit, external audit and enterprise risk — not just attendance at review meetings.",
        validation: "Audit exposure is scored on named findings owned, remediation cycles led and audit-firm interaction.",
        flags: {
          good: "Remediated three prior-year audit findings and owned SOX walkthroughs.",
          bad: "'Audit exposure' cited without named engagements or findings.",
        },
      },
    ],
  },
  healthcare: {
    label: "What we evaluate in healthcare hires",
    signals: [
      {
        key: "licensing",
        title: "Licensing & credentials",
        body: "Active licensure, board certification, DEA / prescribing authority where applicable — validated by jurisdiction, not just listed on the CV.",
        validation: "Licence numbers, expiry, DEA/registration and state or country coverage are confirmed before a candidate reaches a shortlist.",
        flags: {
          good: "Active state RN licence, ACLS current, DEA registered where clinical role requires it.",
          bad: "Certifications listed without licence number, expiry or jurisdiction.",
        },
      },
      {
        key: "caseload",
        title: "Caseload & patient volume",
        body: "Real caseload volume — patients seen per shift or per week — and case-mix relevant to the target unit.",
        validation: "Caseload numbers are checked against the practice setting, EHR system and tenure described.",
        flags: {
          good: "22–28 patients per shift in a Level II trauma centre for 3 years.",
          bad: "Case types listed without volume, unit or acuity context.",
        },
      },
      {
        key: "setting",
        title: "Practice setting fit",
        body: "The clinical setting the candidate has operated in — inpatient, outpatient, ambulatory, home health, community — versus the target role's setting.",
        validation: "Setting is validated against employer type, unit description and shift model; mismatches are surfaced, not hidden.",
        flags: {
          good: "5 years inpatient med-surg, then 2 years ambulatory oncology infusion.",
          bad: "'Broad clinical experience' claim with no named setting or acuity.",
        },
      },
      {
        key: "protocols",
        title: "Protocols & evidence base",
        body: "Adherence to named clinical protocols, guideline familiarity, and continuing-education currency.",
        validation: "Protocol references are cross-checked against the employer's guideline set and any state-specific mandates.",
        flags: {
          good: "Named protocols followed (e.g. sepsis bundle) with quality-outcome results.",
          bad: "Generic 'evidence-based practice' claim with no named protocol.",
        },
      },
      {
        key: "compliance",
        title: "Compliance & documentation",
        body: "HIPAA, GDPR-health, and documentation-quality signals — audits passed, chart-review outcomes, and named EHR fluency.",
        validation: "Documentation quality is checked against chart-audit exposure, EHR system named, and any prior compliance findings.",
        flags: {
          good: "Zero adverse chart-audit findings across 18 months in Epic.",
          bad: "EHR listed with no audit history or documentation quality signal.",
        },
      },
    ],
  },
  legal: {
    label: "What we evaluate in legal hires",
    signals: [
      {
        key: "jurisdiction",
        title: "Jurisdiction fluency",
        body: "The jurisdictions the candidate is qualified to practise in and has actually operated in — federal, state, cross-border — matched to the target role.",
        validation: "Bar admissions and practice jurisdiction are cross-checked against named matters and client geography.",
        flags: {
          good: "Admitted in NY and England & Wales; named counsel on US–UK commercial deals.",
          bad: "Admission listed with no matching matter jurisdiction.",
        },
      },
      {
        key: "matter",
        title: "Matter type coverage",
        body: "The matter types the candidate has led or been named on — M&A, commercial contracts, employment, IP, dispute — with deal value and complexity.",
        validation: "Matter descriptions are checked against firm or in-house tenure and named deal counterparties; passive participation is scored separately.",
        flags: {
          good: "Named counsel on 14 cross-border SaaS commercial contracts with named counterparties.",
          bad: "Long matter list without deal value, counterparty or ownership scope.",
        },
      },
      {
        key: "bar",
        title: "Bar status & good standing",
        body: "Active bar admissions, good-standing certificates, CLE currency, and any pending disciplinary matters.",
        validation: "Bar status is confirmed with the admitting authority; good-standing evidence is requested where role requires it.",
        flags: {
          good: "Active bar admission with current CLE and good-standing certificate.",
          bad: "Bar admission listed without renewal or CLE detail.",
        },
      },
      {
        key: "regulated",
        title: "Regulatory & compliance exposure",
        body: "Direct exposure to regulators, filings, or supervised enforcement — versus advisory-only exposure.",
        validation: "Regulatory exposure is validated against named filings, agency contact and outcome documentation.",
        flags: {
          good: "Led SEC comment-letter responses for a Nasdaq-listed SaaS issuer.",
          bad: "Regulatory 'awareness' cited without a named filing or agency touchpoint.",
        },
      },
      {
        key: "commercial",
        title: "Commercial judgement",
        body: "Business-partnering evidence — advising on risk with commercial trade-offs — beyond issue-spotting.",
        validation: "Commercial judgement is checked against escalation notes, board memos and matter outcomes named on the CV.",
        flags: {
          good: "Redlined a $12M master services agreement with named commercial trade-offs.",
          bad: "'Commercially minded' claim with no supporting matter or memo.",
        },
      },
    ],
  },
  construction: {
    label: "What we evaluate in construction hires",
    signals: [
      {
        key: "project-type",
        title: "Project type & scale",
        body: "The project types the candidate has delivered — commercial, residential, industrial, civil — with contract value, storeys, or scope described.",
        validation: "Project scale is cross-checked against named employer, contract value and role on site (superintendent, PM, foreman).",
        flags: {
          good: "Superintendent on a $42M mid-rise commercial build with 21-month schedule.",
          bad: "Project list without contract value, scope, or named role on site.",
        },
      },
      {
        key: "safety",
        title: "Safety record",
        body: "Named safety credentials (OSHA 30, IOSH, CSCS), incident history and lost-time-incident rate on delivered projects.",
        validation: "Safety credentials are cross-checked with the issuing body; LTI and TRIR numbers are matched against project scale and tenure.",
        flags: {
          good: "OSHA 30 current, zero lost-time incidents over 21-month project.",
          bad: "Safety credentials listed without incident history or project context.",
        },
      },
      {
        key: "delivery",
        title: "Delivery scale & method",
        body: "Contract value delivered, delivery method (design-build, CM-at-risk, IPD) and named schedule / budget outcomes.",
        validation: "Delivery outcomes are validated against contract type, tenure, and named schedule variance.",
        flags: {
          good: "Delivered a $28M design-build project 3 weeks ahead of baseline.",
          bad: "'Delivered projects on time' cited without contract value or method.",
        },
      },
      {
        key: "trades",
        title: "Sub-trade & vendor management",
        body: "Number and complexity of sub-trades coordinated, with named procurement or long-lead materials owned.",
        validation: "Sub-trade coordination is checked against project schedule detail and named vendor / long-lead items.",
        flags: {
          good: "Coordinated 27 sub-trades with named long-lead procurement plan.",
          bad: "'Managed subs' cited without named trades, packages or schedule detail.",
        },
      },
      {
        key: "compliance",
        title: "Permitting & compliance",
        body: "Permitting exposure, code jurisdiction fluency, and inspection outcomes for the projects named.",
        validation: "Permitting exposure is confirmed against the AHJ and named inspection history; adjacent exposure is not conflated with ownership.",
        flags: {
          good: "Owned permitting through two AHJs with zero re-inspections on core packages.",
          bad: "'Permitting exposure' cited with no AHJ or inspection outcome.",
        },
      },
    ],
  },
};

function buildGenericPack(entry: IndustryEntry): Pack {
  const own = (entry.candidateSignals ?? []).slice(0, 5);
  const fallback: Signal[] = own.length
    ? own.map((s, i) => ({
        key: `own-${i}`,
        title: s.title,
        body: s.body,
        validation: `Every ${entry.name.toLowerCase()} match against this signal is tied to a quoted CV line and reviewed before the shortlist reaches you.`,
        flags: {
          good: `Named evidence on the CV with scope, timeline and outcome specific to ${entry.name.toLowerCase()}.`,
          bad: `Claim asserted without a matching project, employer or timeline.`,
        },
      }))
    : [
        {
          key: "relevant",
          title: "Relevant experience",
          body: `Direct experience in comparable ${entry.name} roles, scoped to the seniority and remit of the position.`,
          validation: `${entry.name} experience is scored on scope and outcome, not tenure alone.`,
          flags: {
            good: "Named projects with scope, timeline and outcome.",
            bad: "Long tenure without any named ownership or outcome.",
          },
        },
        {
          key: "domain",
          title: "Domain exposure",
          body: `Time spent inside ${entry.name} organisations or regulated environments that transfer cleanly.`,
          validation: "Adjacent exposure is scored separately from primary experience — never conflated.",
          flags: {
            good: `Direct ${entry.name.toLowerCase()} employer or documented adjacent transfer.`,
            bad: "No named employer type, or adjacent exposure marketed as primary.",
          },
        },
        {
          key: "authorization",
          title: "Work authorization & location",
          body: "Right to work and location model captured at intake — a first-class filter, not a footnote.",
          validation: "Authorization is confirmed for the target market before shortlist.",
          flags: {
            good: "Confirmed right to work with named market and location model.",
            bad: "Authorization unclear or unstated for the target geography.",
          },
        },
      ];
  return {
    label: `What we evaluate in ${entry.name} hires`,
    signals: fallback,
  };
}
