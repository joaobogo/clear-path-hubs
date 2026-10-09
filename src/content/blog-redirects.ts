/**
 * Permanent (301) redirects for retired blog slugs.
 *
 * In July 2026 the five templated posts per industry were consolidated into one
 * guide per industry (see docs/migration/claims-ledger.md, "Blog consolidation").
 * The old JSON files are kept as drafts for history; their URLs redirect here.
 *
 * Rules (enforced by src/content/__tests__/blog-redirects.test.ts and the
 * scripts/ checks): every target is a live post, no target is itself a source
 * (no chains), and no source is live.
 */
export const BLOG_REDIRECTS: Readonly<Record<string, string>> = {
  "accounting-emerging-skills-shift-2026": "accounting-hiring-guide-2026",
  "accounting-hiring-benchmarks-2026": "accounting-hiring-guide-2026",
  "accounting-retention-culture-playbook": "accounting-hiring-guide-2026",
  "accounting-top-roles-compensation-2026": "accounting-hiring-guide-2026",
  "accounting-workforce-outlook-2026": "accounting-hiring-guide-2026",
  "cybersecurity-emerging-skills-shift-2026": "cybersecurity-hiring-guide-2026",
  "cybersecurity-hiring-benchmarks-2026": "cybersecurity-hiring-guide-2026",
  "cybersecurity-retention-culture-playbook": "cybersecurity-hiring-guide-2026",
  "cybersecurity-top-roles-compensation-2026": "cybersecurity-hiring-guide-2026",
  "cybersecurity-workforce-outlook-2026": "cybersecurity-hiring-guide-2026",
  "data-analytics-emerging-skills-shift-2026": "data-analytics-hiring-guide-2026",
  "data-analytics-hiring-benchmarks-2026": "data-analytics-hiring-guide-2026",
  "data-analytics-retention-culture-playbook": "data-analytics-hiring-guide-2026",
  "data-analytics-top-roles-compensation-2026": "data-analytics-hiring-guide-2026",
  "data-analytics-workforce-outlook-2026": "data-analytics-hiring-guide-2026",
  "finance-emerging-skills-shift-2026": "finance-hiring-guide-2026",
  "finance-hiring-benchmarks-2026": "finance-hiring-guide-2026",
  "finance-retention-culture-playbook": "finance-hiring-guide-2026",
  "finance-top-roles-compensation-2026": "finance-hiring-guide-2026",
  "finance-workforce-outlook-2026": "finance-hiring-guide-2026",
  "healthcare-emerging-skills-shift-2026": "healthcare-hiring-guide-2026",
  "healthcare-hiring-benchmarks-2026": "healthcare-hiring-guide-2026",
  "healthcare-retention-culture-playbook": "healthcare-hiring-guide-2026",
  "healthcare-top-roles-compensation-2026": "healthcare-hiring-guide-2026",
  "healthcare-workforce-outlook-2026": "healthcare-hiring-guide-2026",
  "insurance-emerging-skills-shift-2026": "insurance-hiring-guide-2026",
  "insurance-hiring-benchmarks-2026": "insurance-hiring-guide-2026",
  "insurance-retention-culture-playbook": "insurance-hiring-guide-2026",
  "insurance-top-roles-compensation-2026": "insurance-hiring-guide-2026",
  "insurance-workforce-outlook-2026": "insurance-hiring-guide-2026",
  "legal-hiring-benchmarks-2026": "legal-hiring-guide-2026",
  "legal-top-roles-compensation-2026": "legal-hiring-guide-2026",
  "private-equity-emerging-skills-shift-2026": "private-equity-hiring-guide-2026",
  "private-equity-hiring-benchmarks-2026": "private-equity-hiring-guide-2026",
  "private-equity-retention-culture-playbook": "private-equity-hiring-guide-2026",
  "private-equity-top-roles-compensation-2026": "private-equity-hiring-guide-2026",
  "private-equity-workforce-outlook-2026": "private-equity-hiring-guide-2026",
  "saas-emerging-skills-shift-2026": "saas-hiring-guide-2026",
  "saas-hiring-benchmarks-2026": "saas-hiring-guide-2026",
  "saas-retention-culture-playbook": "saas-hiring-guide-2026",
  "saas-top-roles-compensation-2026": "saas-hiring-guide-2026",
  "saas-workforce-outlook-2026": "saas-hiring-guide-2026",
  "tech-emerging-skills-shift-2026": "tech-hiring-guide-2026",
  "tech-hiring-benchmarks-2026": "tech-hiring-guide-2026",
  "tech-retention-culture-playbook": "tech-hiring-guide-2026",
  "tech-top-roles-compensation-2026": "tech-hiring-guide-2026",
  "tech-workforce-outlook-2026": "tech-hiring-guide-2026",
};

/** The live slug a retired slug permanently redirects to, if any. */
export function resolveBlogRedirect(slug: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(BLOG_REDIRECTS, slug)
    ? BLOG_REDIRECTS[slug]
    : undefined;
}
