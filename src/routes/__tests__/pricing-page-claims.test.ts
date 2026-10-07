import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRICING_TIERS, PRICING_GUARANTEES } from "@/content/pricing";
import { SUBSCRIPTION_TIERS } from "@/content/pricing-subscriptions";
import { PRICING_FAQ } from "@/content/pricing-faq";
import {
  PUBLIC_ONEOFF_ENTITLEMENTS,
  PUBLIC_SUBSCRIPTION_ENTITLEMENTS,
  PUBLIC_PLAN_IDS,
  PUBLIC_PLAN_LABELS,
  SCOPED_PUBLIC_LABEL,
  publicSeatsLine,
} from "@/config/pricing-entitlements";
import { CTA_BOOK, CTA_PRIMARY } from "@/config/cta";
import { FIRST_SHORTLIST_TIMING_SHORT } from "@/config/offer-facts";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const page = read("src/routes/pricing.tsx");

describe("/pricing page", () => {
  it("uses the shared CTAs and drops the retired labels", () => {
    expect(page).toContain("primary={CTA_PRIMARY}");
    expect(page).toContain("secondary={CTA_BOOK}");
    for (const f of [
      "src/routes/pricing.tsx",
      "src/content/pricing.ts",
      "src/content/pricing-subscriptions.ts",
      "src/components/marketing/agency-fee-comparison.tsx",
    ]) {
      const src = read(f);
      expect(src).not.toContain("Book a discovery call");
      expect(src).not.toContain("Start a role");
    }
  });

  it("has the approved H1 and title built from the price constant", () => {
    expect(page).toContain("Flat-fee recruiting. ${PRICE_PILOT_DISPLAY} for your first role.");
    expect(page).toContain("Recruiting Packages & ${PRICE_PILOT_DISPLAY} Pilot | TaaSFlow");
  });

  it("no longer cross-sells FlowPlaced or shows the Continue on TaaSFlow block", () => {
    expect(page).not.toContain("EcosystemCrossSell");
    expect(page).not.toContain("PageConnections");
  });

  it("does not reuse the shared case-study heading", () => {
    expect(page).toContain("<CaseStudyPreviews");
    expect(page).toContain('title="Example engagements by industry"');
  });
});

describe("package cards", () => {
  it("shows the pilot first with the primary action, others book a call", () => {
    expect(PRICING_TIERS[0]!.id).toBe("pilot");
    expect(PRICING_TIERS[0]!.ctaLabel).toBe(CTA_PRIMARY.label);
    expect(PRICING_TIERS[0]!.ctaTo).toBe("/pilot");
    for (const t of PRICING_TIERS.filter((x) => x.id !== "pilot" && x.id !== "enterprise")) {
      expect(t.ctaLabel).toBe(CTA_BOOK.label);
    }
  });

  it("shows the pilot plus three packages as cards in both modes", () => {
    expect(PRICING_TIERS.filter((t) => t.card).map((t) => t.id)).toEqual([
      "pilot",
      "growth",
      "scale",
      "volume",
    ]);
    expect(SUBSCRIPTION_TIERS.filter((t) => t.card).map((t) => t.id)).toEqual([
      "pilot",
      "growth",
      "scale",
      "volume",
    ]);
  });

  it("states billing in plain words", () => {
    for (const t of PRICING_TIERS.filter((x) => x.oneTime !== null)) {
      expect(t.pricePer).toMatch(/^Paid once/);
    }
    for (const t of SUBSCRIPTION_TIERS.filter((x) => x.monthly !== null && x.id !== "pilot")) {
      expect(t.billingNote).toBe("Billed monthly");
    }
  });

  it("lists the same items in the same order, with the shared timing", () => {
    const cards = PRICING_TIERS.filter((t) => t.oneTime !== null);
    for (const t of cards) {
      expect(t.included[2]).toBe(FIRST_SHORTLIST_TIMING_SHORT);
      expect(t.included[3]).toMatch(/recruiter reviews/);
      expect(t.included[4]).toMatch(/^Seats: /);
      expect(t.included.filter((i) => /Ranked candidate shortlist/.test(i))).toHaveLength(0);
      expect(t.included.join(" ")).not.toMatch(/refreshed weekly/i);
      expect(t.turnaround).toBe(FIRST_SHORTLIST_TIMING_SHORT);
    }
  });

  it("never prints a per-position price", () => {
    const text = JSON.stringify([PRICING_TIERS, SUBSCRIPTION_TIERS, PRICING_FAQ]);
    expect(text).not.toMatch(/per position|per role|\/position/i);
  });
});

describe("claims", () => {
  it("keeps only true guarantees", () => {
    expect(PRICING_GUARANTEES).toEqual(["No hidden fees", "No placement fee"]);
  });

  it("FAQ answer matches the cards on billing", () => {
    const a = PRICING_FAQ.find((f) => f.q.startsWith("Do prices go up"))!.a;
    expect(a).toContain("paid once");
    expect(a).toContain("charged each month");
    expect(a).not.toContain("The monthly fee covers");
  });

  it("does not say 'You keep every candidate'", () => {
    const all = JSON.stringify([PRICING_FAQ, PRICING_TIERS]) + page;
    expect(all).not.toMatch(/keep every candidate|keep all candidates/i);
  });
});

describe("public entitlement table", () => {
  it("covers every sold package and labels above 100 as scoped", () => {
    expect(PUBLIC_PLAN_IDS).toEqual([
      "pilot",
      "growth",
      "scale",
      "volume",
      "portfolio",
      "program",
      "enterprise",
    ]);
    expect(PUBLIC_PLAN_LABELS.portfolio).toBe("Up to 40 positions");
    expect(PUBLIC_PLAN_LABELS.program).toBe("Up to 100 positions");
    expect(PUBLIC_PLAN_LABELS.enterprise).toBe("More than 100 positions: scoped");
    for (const rows of [PUBLIC_ONEOFF_ENTITLEMENTS, PUBLIC_SUBSCRIPTION_ENTITLEMENTS]) {
      for (const row of rows) {
        for (const id of PUBLIC_PLAN_IDS) expect(row.plans[id]).toBeDefined();
      }
    }
  });

  it("says scoped for undefined cells, not invented features", () => {
    const seats = PUBLIC_ONEOFF_ENTITLEMENTS.find((r) => r.id === "workspace_seats")!;
    expect(seats.plans.portfolio).toEqual({ kind: "value", label: SCOPED_PUBLIC_LABEL, note: undefined });
    expect(publicSeatsLine("pilot")).toBe("2 seats: 1 owner + 1 recruiter");
    expect(publicSeatsLine("program")).toBe(SCOPED_PUBLIC_LABEL);
  });

  it("drops the refreshed-weekly note", () => {
    expect(JSON.stringify(PUBLIC_ONEOFF_ENTITLEMENTS)).not.toMatch(/Refreshed weekly/);
  });
});
