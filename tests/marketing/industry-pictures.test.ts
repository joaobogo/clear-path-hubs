import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { INDUSTRY_ENTRIES } from "../../src/content/industries-v2";
import { getIndustryHeroImage } from "../../src/content/industry-hero-images";

describe("Industry pictures", () => {
  it("offers accessible homepage evidence and controllable line motion", () => {
    const hero = readFileSync("src/components/home/run-hero.tsx", "utf8");
    expect(hero).toContain('aria-label="Replay line animation"');
    expect(hero).toContain('"Pause line animation"');
    expect(hero).toContain('aria-pressed={selectedRef === c.ref}');
    expect(hero).toContain('selected?.results.licence.evidence');
    expect(hero).toContain('aria-live="polite"');
    expect(hero).not.toContain("bg-white/");
    const field = readFileSync("src/components/signature/convergence-field.tsx", "utf8");
    expect(field).toContain('document.addEventListener("visibilitychange", resume)');
    expect(field).toContain('visibility.disconnect()');
    expect(field).toContain('reduced || paused');
    expect(field).toContain('ctx.drawImage(still, 0, 0, w, h)');
    expect(field).toContain('if (Math.round(rect.width) === w');
  });
  it("illustrates homepage sectors and keeps recurring package prices monthly", () => {
    const proof = readFileSync("src/components/home/chapters/chapter-proof.tsx", "utf8");
    expect(proof).toContain("getIndustryHeroImage(SECTOR_IMAGES[r.sector]");
    expect(proof).toContain("<HeroPicture");
    const pricing = readFileSync("src/routes/pricing.tsx", "utf8");
    expect(pricing).toContain('billing === "monthly" && p.id !== "pilot"');
    expect(pricing).toContain('formatUsdExact(subscriptionTotalsUsd(p.capacity).monthly)');
  });
  it("prioritizes takeaways while keeping full examples accessible", () => {
    const examples = readFileSync("src/routes/case-studies.tsx", "utf8");
    expect(examples).toContain("The takeaway");
    expect(examples).toContain("Read the full example");
    expect(examples).toContain("{study.situation}");
    expect(examples).toContain("{study.outcome}");
    expect(examples).toContain("{study.timeline.map");
    expect(examples).not.toContain("line-clamp");
    const agents = readFileSync("src/routes/agents.tsx", "utf8");
    expect(agents.indexOf('label="Outputs"')).toBeLessThan(agents.indexOf('label="Inputs"'));
    expect(agents).toContain("View representative activity");
    const process = readFileSync("src/routes/how-it-works.tsx", "utf8");
    expect(process).toContain("Your part & our part");
    expect(process).toContain("{STEP_DETAIL[i]?.you}");
    expect(process).toContain("{STEP_DETAIL[i]?.we}");
    const score = readFileSync("src/components/home/chapters/chapter-score.tsx", "utf8");
    expect(score).not.toContain("<blockquote");
    expect(score).toContain("No sentence found.");
  });
  it("keeps pricing scannable and avoids repeated comparison and FAQ blocks", () => {
    const pricing = readFileSync("src/routes/pricing.tsx", "utf8");
    expect(pricing).toContain('aria-label="Pricing sections"');
    expect(pricing).toContain('id="packages"');
    expect(pricing).toContain('id="included"');
    expect(pricing).toContain('id="terms"');
    expect(pricing).not.toContain("<ModelComparisonTable");
    expect(pricing).not.toContain("{FAQ.map");
    expect(pricing).toContain("pilot paid once");
  });

  it("illustrates examples honestly without empty testimonial placeholders", () => {
    const examples = readFileSync("src/routes/case-studies.tsx", "utf8");
    expect(examples).toContain("getIndustryHeroImage(STUDY_INDUSTRIES[study.slug]");
    expect(examples).toContain("<HeroPicture");
    expect(examples).toContain("They are not reported client results");
    expect(examples).not.toContain("<ProcessStrip");
    expect(examples).not.toContain("No quote is published");
    expect(examples).toContain('aria-label="Example industries"');
    const rail = readFileSync("src/components/layout/chapter-rail.tsx", "utf8");
    expect(rail).toContain("overflow-x-auto");
  });
  it("provides a distinct picture and description for every industry", () => {
    const images = INDUSTRY_ENTRIES.map((entry) => getIndustryHeroImage(entry.slug));
    for (const image of images) {
      expect(image?.src).toBeTruthy();
      expect(image?.src).not.toMatch(/^https:\/\/images\.unsplash\.com/);
      expect(image?.alt.length).toBeGreaterThan(20);
      expect(image?.width).toBeGreaterThanOrEqual(1600);
    }
    expect(new Set(images.map((image) => image?.src)).size).toBe(INDUSTRY_ENTRIES.length);
  });

  it("uses the shared photo registry on industry cards", () => {
    const source = readFileSync("src/routes/industries.index.tsx", "utf8");
    expect(source).toContain("getIndustryHeroImage(tile.slug)");
    expect(source).toContain("<HeroPicture");
    expect(source).not.toContain("FamilyMotif");
  });

  it("extends chapter surfaces without increasing layout width", () => {
    const css = readFileSync("src/styles/run.css", "utf8");
    expect(css).toContain(".run-chapters .run-chapter::before");
    expect(css).toContain("clip-path: inset(0 -100vmax)");
    expect(css).toContain("pointer-events: none");
  });

  it("balances the chapter rail with equal space on the right", () => {
    const chapters = readFileSync("src/components/home/run-chapters.tsx", "utf8");
    const rail = readFileSync("src/components/layout/chapter-rail.tsx", "utf8");
    expect(chapters).toContain("xl:grid-cols-[160px_minmax(0,1fr)_160px]");
    expect(chapters).toContain("mx-auto w-full min-w-0 max-w-[var(--max)]");
    expect(rail).toContain("xl:block");
    expect(rail).toContain("xl:hidden");
  });

  it("puts sector photographs before diagram-led hero copy", () => {
    const source = readFileSync("src/components/marketing/industry-page.tsx", "utf8");
    for (const name of ["HeroSystemsCapability", "HeroRiskJudgment", "HeroOperationsDelivery", "HeroExpertiseGrowth"]) {
      const body = source.slice(source.indexOf(`function ${name}(`));
      expect(body.indexOf("<HeroImageBand")).toBeLessThan(body.indexOf("{entry.eyebrow}"));
    }
    expect(source).toContain("relative p-6 sm:absolute");
  });

  it("adds meaningful photographs without replacing conversion controls", () => {
    for (const [file, control] of [
      ["src/components/home/chapters/chapter-signoff.tsx", "<DecisionCell"],
      ["src/routes/pilot.tsx", "<EmployerInquiryForm"],
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("<PagePhotograph");
      expect(source).toContain(control);
    }
    const photo = readFileSync("src/components/marketing/page-photograph.tsx", "utf8");
    expect(photo).toContain('loading={priority ? "eager" : "lazy"}');
    expect(photo).toContain("width={width}");
    expect(photo).toContain("height={height}");
    expect(photo).toContain("alt={alt}");
  });
  it("integrates buying-page imagery without delaying pricing controls", () => {
    const pricing = readFileSync("src/routes/pricing.tsx", "utf8");
    expect(pricing.indexOf("<PackageSelector")).toBeLessThan(pricing.indexOf("<PhotoBand"));
    const money = readFileSync("src/components/marketing/money-page.tsx", "utf8");
    expect(money).toContain("BUYER_PAGE_PHOTOGRAPHS[page.slug]");
    expect(money).toContain("<EditorialCover");
    expect(money).toContain("{page.directAnswer}");
    expect(readFileSync("src/components/home/run-hero.tsx", "utf8")).not.toContain("<PagePhotograph");
  });
  it("keeps photography visible with reduced motion and captions below images on mobile", () => {
    const css = readFileSync("src/styles/run.css", "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("transform: none !important; transition: none");
    const bands = readFileSync("src/components/marketing/editorial-hero.tsx", "utf8");
    expect(bands).toContain('className="relative mx-auto max-w-[1200px]');
    expect(bands).toContain("sm:absolute");
  });
});