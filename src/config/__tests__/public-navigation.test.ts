import { describe, expect, it } from "vitest";
import {
  MESSAGE_CTA,
  CANDIDATE_PRIMARY_CTA,
  FOOTER_GROUPS,
  PRIMARY_CTA,
  PRIMARY_ITEMS,
  SECONDARY_CTAS,
  allNavHrefs,
} from "@/config/public-navigation";
import { CTA_MESSAGE, CTA_PRIMARY } from "@/config/cta";
import { HOMEPAGE_FAQ } from "@/lib/homepage-faq";
import { SYSTEM_CLAIM } from "@/config/product-language";
import { WHO_RUNS_THE_SEARCH_SHORT } from "@/config/offer-facts";
import { PREVIEW_DECISION_QUEUE, PREVIEW_TOP_SCORE } from "@/lib/previews/representative-fixtures";

const RETIRED = [
  "Open your first role",
  "Start hiring",
  "Start a role",
  "Book call",
  "Book a call with the founders",
  "Book a discovery call",
  "See the platform",
  "Candidate Sign In",
];

describe("public navigation", () => {
  it("uses the shared CTA vocabulary", () => {
    expect(PRIMARY_CTA.label).toBe(CTA_PRIMARY.label);
    expect(PRIMARY_CTA.to).toBe("/pilot");
    expect(MESSAGE_CTA.label).toBe(CTA_MESSAGE.label);
    expect(MESSAGE_CTA.to).toBe("/contact");
  });

  it("keeps the candidate CTA split unchanged", () => {
    expect(CANDIDATE_PRIMARY_CTA.to).toBe("/jobs");
    expect(SECONDARY_CTAS.map((c) => c.to)).toEqual(["/jobs", "/login"]);
  });

  it("has five header links and no dropdowns", () => {
    expect(PRIMARY_ITEMS.map((i) => i.label)).toEqual([
      "How a role runs",
      "Pricing",
      "Results",
      "Industries",
      "Agents",
    ]);
    expect(PRIMARY_ITEMS.every((i) => i.kind === "link")).toBe(true);
  });

  it("footer has the agreed columns and no retired pages", () => {
    expect(FOOTER_GROUPS.map((g) => g.label)).toEqual([
      "Product",
      "Buying",
      "Proof",
      "Candidates",
      "Legal",
    ]);
    const hrefs = allNavHrefs();
    for (const gone of ["/status", "/changelog", "/candidate-success", "/knowledge-base", "/journey", "/sitemap", "/platform", "/system", "/employer-onboarding", "/trust"]) {
      expect(hrefs).not.toContain(gone);
    }
    const labels = FOOTER_GROUPS.flatMap((g) => g.links.map((l) => l.label));
    for (const r of RETIRED) expect(labels).not.toContain(r);
    for (const l of ["For HR teams", "For founders", "Compare", "Security"]) expect(labels).toContain(l);
    for (const gone of ["Trust pack", "Trust Center", "Employer onboarding", "Platform", "Intelligence"]) {
      expect(labels).not.toContain(gone);
    }
  });

  it("homepage FAQ has the six agreed questions", () => {
    expect(HOMEPAGE_FAQ).toHaveLength(6);
    expect(HOMEPAGE_FAQ[2].a).toContain("A recruiter reviews every shortlist");
  });

  it("system claim matches the who-runs-the-search sentence", () => {
    expect(SYSTEM_CLAIM).toBe(WHO_RUNS_THE_SEARCH_SHORT);
  });

  it("the preview candidate carries one score", () => {
    expect(PREVIEW_DECISION_QUEUE[0].score).toBe(PREVIEW_TOP_SCORE);
  });
});
