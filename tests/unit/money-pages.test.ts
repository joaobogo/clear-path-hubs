/**
 * Guards for the buyer-intent pages: unique canonical, FAQ JSON-LD that matches
 * the visible FAQ, a 40 to 60 word direct answer, question-form headings, a
 * sensible length, and no numbers other than the allowed ones.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGENCY_FEE_RANGE_PCT,
  MONEY_PAGES,
  MODEL_CELLS,
  agencyFeeExample,
  type MoneyPageContent,
} from "@/content/money-pages";
import { moneyPageHead } from "@/components/marketing/money-page";
import { CANONICAL_ORIGIN } from "@/lib/canonical-origin";
import { PRICE_PILOT_USD } from "@/config/pricing-core";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function pageWords(p: MoneyPageContent): number {
  const sec = [...p.sections, ...p.sectionsAfter].flatMap((s) => [
    s.h2,
    ...s.paragraphs,
    ...(s.bullets ?? []),
  ]);
  const table = p.comparison.dimensions.flatMap((d) =>
    Object.values(MODEL_CELLS).map((row) => row[d]),
  );
  const faqs = p.faqs.flatMap((f) => [f.q, f.a]);
  return [p.h1, p.directAnswer, p.comparison.h2, p.comparison.intro, ...sec, ...table, ...faqs]
    .map(words)
    .reduce((a, b) => a + b, 0);
}

function scripts(p: MoneyPageContent) {
  const head = moneyPageHead(p) as { scripts?: { children: string }[] };
  return (head.scripts ?? []).map((s) => JSON.parse(s.children));
}

describe("money pages", () => {
  it("has five pages with unique paths, titles and descriptions", () => {
    expect(MONEY_PAGES).toHaveLength(5);
    for (const key of ["path", "title", "description", "h1"] as const) {
      expect(new Set(MONEY_PAGES.map((p) => p[key])).size, key).toBe(MONEY_PAGES.length);
    }
  });

  it.each(MONEY_PAGES.map((p) => [p.path, p] as const))("%s head has its own canonical", (_path, page) => {
    const head = moneyPageHead(page) as { links: { rel: string; href: string }[] };
    const canonical = head.links.find((l) => l.rel === "canonical")?.href;
    expect(canonical).toBe(`${CANONICAL_ORIGIN}${page.path}`);
  });

  it.each(MONEY_PAGES.map((p) => [p.path, p] as const))("%s FAQ JSON-LD matches the visible FAQ", (_path, page) => {
    const faq = scripts(page).find((s) => s["@type"] === "FAQPage");
    expect(faq).toBeTruthy();
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(page.faqs.map((f) => f.q));
    expect(faq.mainEntity.map((q: { acceptedAnswer: { text: string } }) => q.acceptedAnswer.text)).toEqual(
      page.faqs.map((f) => f.a),
    );
    expect(page.faqs.length).toBeGreaterThanOrEqual(6);
    expect(page.faqs.length).toBeLessThanOrEqual(8);
  });

  it.each(MONEY_PAGES.map((p) => [p.path, p] as const))("%s emits breadcrumb and service schema", (_path, page) => {
    const types = scripts(page).map((s) => s["@type"]);
    expect(types).toContain("BreadcrumbList");
    expect(types).toContain("Service");
  });

  it.each(MONEY_PAGES.map((p) => [p.path, p] as const))("%s has a 40 to 60 word direct answer", (_path, page) => {
    const n = words(page.directAnswer);
    expect(n).toBeGreaterThanOrEqual(40);
    expect(n).toBeLessThanOrEqual(60);
  });

  it.each(MONEY_PAGES.map((p) => [p.path, p] as const))("%s uses question-form headings", (_path, page) => {
    const h2s = [...page.sections, ...page.sectionsAfter].map((s) => s.h2).concat(page.comparison.h2);
    for (const h of h2s) expect(h.endsWith("?"), h).toBe(true);
  });

  it.each(MONEY_PAGES.map((p) => [p.path, p] as const))("%s is 900 to 1,400 words", (_path, page) => {
    const n = pageWords(page);
    expect(n).toBeGreaterThanOrEqual(900);
    expect(n).toBeLessThanOrEqual(1400);
  });

  it("never reuses a paragraph across pages", () => {
    const seen = new Map<string, string>();
    for (const p of MONEY_PAGES) {
      for (const s of [...p.sections, ...p.sectionsAfter]) {
        for (const para of s.paragraphs) {
          const prev = seen.get(para);
          // The shared agency illustration sentence is the one allowed repeat.
          if (prev && prev !== p.slug && !para.includes("As an illustration only")) {
            throw new Error(`Paragraph reused on ${prev} and ${p.slug}: ${para.slice(0, 80)}`);
          }
          seen.set(para, p.slug);
        }
      }
    }
  });

  it("computes the agency example from the constant range", () => {
    const e = agencyFeeExample();
    expect(e.low).toBe((85_000 * AGENCY_FEE_RANGE_PCT.low) / 100);
    expect(e.high).toBe((85_000 * AGENCY_FEE_RANGE_PCT.high) / 100);
    expect(e.spanDisplay).toBe("$17,000–$21,250");
  });

  it("publishes no dollar figure other than TaaSFlow prices and the agency example", () => {
    const allowed = new Set<string>([`$${PRICE_PILOT_USD}`, "$8,000", "$15,200", "$85,000", "$17,000–$21,250", "$17,000", "$21,250"]);
    for (const p of MONEY_PAGES) {
      const text = JSON.stringify(p) + Object.values(MODEL_CELLS).map((r) => Object.values(r).join(" ")).join(" ");
      for (const m of text.matchAll(/\$\d{1,3}(?:,\d{3})*(?:–\$\d{1,3}(?:,\d{3})*)?/g)) {
        expect(allowed.has(m[0]), `${p.slug}: unexpected figure ${m[0]}`).toBe(true);
      }
    }
  });

  it("states no guarantee and no testimonials", () => {
    for (const p of MONEY_PAGES) {
      const text = JSON.stringify(p).toLowerCase();
      expect(text).not.toMatch(/money-back|we guarantee|guaranteed shortlist|testimonial/);
    }
  });

  it.each(MONEY_PAGES.map((p) => [p.slug, p] as const))("%s route file serves its own page", (slug, page) => {
    const src = readFileSync(join(process.cwd(), "src", "routes", `${slug}.tsx`), "utf8");
    expect(src).toContain(`createFileRoute("${page.path}")`);
    expect(src).toContain("moneyPageHead");
  });

  it("links every page to pricing, pilot, how-it-works and both sector pages", () => {
    for (const p of MONEY_PAGES) {
      const targets = p.related.map((r) => r.to);
      for (const t of ["/pricing", "/pilot", "/how-it-works", "/industries/hospitality", "/industries/healthcare"]) {
        expect(targets, p.slug).toContain(t);
      }
    }
  });

  it("redirects the old resource URL permanently and keeps it out of links", () => {
    const route = readFileSync(join(process.cwd(), "src", "routes", "resources.$slug.tsx"), "utf8");
    expect(route).toMatch(/redirect\(\{ href: moved, statusCode: 301 \}\)/);
    for (const f of ["guides-foundations", "guides-comparisons", "guides-operations"]) {
      const src = readFileSync(join(process.cwd(), "src", "content", "resources", `${f}.ts`), "utf8");
      expect(src).not.toMatch(/slug: "recruiting-as-a-service"/);
      expect(src).not.toMatch(/\/resources\/recruiting-as-a-service/);
    }
  });
});
