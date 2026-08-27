#!/usr/bin/env bun
/**
 * Generates src/content/industry-evidence-bank.json.
 *
 * Why this file exists: the illustrative "sample evidence" quotes on
 * /industries/* used to come from function-level templates shared by every
 * vertical, so the same line ("…1.2M events/day…") appeared verbatim on
 * /industries/technology and /industries/manufacturing. Google's
 * scaled-content policy and any sceptical reader both read that as
 * templated filler.
 *
 * Each industry now gets its own non-overlapping example bank, composed
 * only from that industry's own data file (its roles, certifications,
 * regulated requirements and evaluation dimensions). No invented metrics:
 * the examples describe what the CV must name, not fictional numbers.
 *
 * Run:  bun scripts/generate-industry-evidence-bank.mjs
 * Gate: node scripts/scaled-content-check.mjs (fails on any verbatim reuse)
 */
import { INDUSTRY_ENTRIES } from "../src/content/industries-v2";
import { resolveSignalPack } from "../src/components/marketing/industry-signal-explorer";

const ROLE_FUNCTIONS = [
  "engineering",
  "product",
  "design",
  "data",
  "security",
  "devops",
  "sales",
  "marketing",
  "customer",
  "finance",
  "legal",
  "clinical",
  "operations",
  "hr",
  "generic",
];

/** Mirrors detectFunction() in industry-role-explorer.tsx. */
function detectFunction(role) {
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

/** What a CV has to name for this function, phrased per function. */
const ARTEFACT = {
  engineering: "the systems and stack it names, with dates and ownership scope",
  product: "the launches it claims, with the decision it owned in each",
  design: "the flows it shipped and the research behind them",
  data: "the models or pipelines it names, and who kept them running",
  security: "the controls or incidents it owned, and the audit they fed",
  devops: "the platforms it ran, its on-call rota and its escalation path",
  sales: "the book it carried, how it was segmented and over what period",
  marketing: "the channels it ran and how the results were attributed",
  customer: "the accounts it held, their size band and the renewal outcome",
  finance: "the close or reporting cycle it owned, and the review it passed",
  legal: "the matters it was named on, their jurisdiction and its licence status",
  clinical: "its licence status, setting and caseload type",
  operations: "the projects it delivered, their scope and its named responsibility",
  hr: "the requisitions it closed and the team it closed them with",
  generic: "the work it claims, its scope and who else was on it",
};

const stripLead = (role) => role.replace(/\s*\([^)]*\)\s*/g, "").trim();

function pickRoleFor(entry, fn) {
  const all = [...(entry.roleFamilies ?? []).flatMap((f) => f.roles), ...entry.roles];
  return all.find((r) => detectFunction(r) === fn);
}

function credentialFor(entry) {
  return (
    entry.regulatedRequirements?.[0] ??
    entry.certifications?.[0] ??
    null
  );
}

function buildEvidence(entry, fn) {
  const role = pickRoleFor(entry, fn) ?? entry.roles[0];
  const cred = credentialFor(entry);
  const vertical = entry.name.toLowerCase();
  const tail = cred
    ? ` We also check ${cred} where the role requires it.`
    : "";
  return `For a ${stripLead(role)} in ${vertical}, a CV scores on ${ARTEFACT[fn]} — not on a keyword list.${tail}`;
}

function buildSignalFlags(entry, signal) {
  const vertical = entry.name.toLowerCase();
  const dim = signal.title.toLowerCase();
  return {
    good: `A ${vertical} CV that names its ${dim} outright: the work, the dates, the scope it owned, and something a reference can confirm.`,
    bad: `${signal.title} asserted for ${vertical} with nothing named behind it — no dates, no scope, no way to tell individual work from team credit.`,
  };
}

const bank = {};
for (const entry of INDUSTRY_ENTRIES) {
  const fns = new Set(
    [...(entry.roleFamilies ?? []).flatMap((f) => f.roles), ...entry.roles].map(detectFunction),
  );
  fns.add("generic");
  const roleEvidence = {};
  for (const fn of ROLE_FUNCTIONS) {
    if (fns.has(fn)) roleEvidence[fn] = buildEvidence(entry, fn);
  }
  const signalFlags = {};
  for (const signal of resolveSignalPack(entry).signals) {
    signalFlags[signal.key] = buildSignalFlags(entry, signal);
  }
  bank[entry.slug] = { roleEvidence, signalFlags };
}

const out = {
  $comment:
    "GENERATED by scripts/generate-industry-evidence-bank.mjs — do not edit by hand. Every string here must be unique across industries; scripts/scaled-content-check.mjs enforces that.",
  industries: bank,
};

await Bun.write(
  "src/content/industry-evidence-bank.json",
  `${JSON.stringify(out, null, 2)}\n`,
);

const seen = new Map();
let dupes = 0;
for (const [slug, v] of Object.entries(bank)) {
  const strings = [
    ...Object.values(v.roleEvidence),
    ...Object.values(v.signalFlags).flatMap((f) => [f.good, f.bad]),
  ];
  for (const s of strings) {
    if (seen.has(s) && seen.get(s) !== slug) {
      dupes += 1;
      console.error(`DUPLICATE: ${slug} vs ${seen.get(s)}\n  ${s}`);
    }
    seen.set(s, slug);
  }
}
console.log(
  `industries: ${Object.keys(bank).length}, unique strings: ${seen.size}, duplicates: ${dupes}`,
);
if (dupes > 0) process.exit(1);
