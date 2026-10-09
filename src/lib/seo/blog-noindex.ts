/**
 * Blog posts that stay reachable but are kept out of search until they are
 * reviewed (thin after claim cleanup, or overlapping another post). They carry
 * `noindex, follow` in their head and are left out of the blog sitemap.
 * Source: docs/seo/blog-inventory.md, decision "Noindex pending review".
 * To publish one again, delete its slug here.
 */
export const NOINDEX_BLOG_SLUGS: readonly string[] = [
  "accounting-firm-recruitment-strategies",
  "ai-screening-ethics",
  "ambient-computing-workplace-transformation",
  "ats-implementation-guide",
  "blockchain-credentials-hiring",
  "boomerang-employees",
  "building-high-performance-teams",
  "candidate-ghosting-prevention",
  "career-pathing-employee-retention",
  "chief-people-officer-evolution",
  "remote-vs-hybrid-talent-strategy",
  "renewable-energy-talent-hiring",
  "return-to-office-talent-impact",
  "revenue-operations-role-breakdown",
  "saas-engineering-team-scaling",
  "saas-go-to-market-hiring-guide",
  "salary-compression-guide",
  "salary-negotiation-from-employer-perspective",
  "salary-trends-2026-comprehensive",
  "sales-leadership-hiring-playbook",
  "sales-team-building-guide",
  "second-chance-hiring-guide",
  "skilled-trades-hiring-crisis",
  "skills-based-organizations-future",
  "skills-gap-analysis-guide",
  "skills-taxonomy-building-guide",
];

export function isNoindexBlogSlug(slug: string): boolean {
  return NOINDEX_BLOG_SLUGS.includes(slug);
}
