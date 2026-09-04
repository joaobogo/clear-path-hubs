import { describe, expect, it } from "vitest";
import {
  extractLanguages,
  extractLinkedinUrl,
  extractSkills,
  extractYearsExperience,
  parseCvFacts,
} from "@/lib/cv/parse-facts";

/**
 * Pins for the deterministic parsed-facts fallback (audit S-20). Every case
 * mirrors a live CV whose facts rendered as "—" on the evidence record.
 */

describe("extractYearsExperience", () => {
  it("reads '6+ years of experience'", () => {
    expect(extractYearsExperience("Full stack developer with 6+ years of experience building SaaS.")).toBe(6);
  });
  it("reads Portuguese '6 anos de experiência'", () => {
    expect(extractYearsExperience("Desenvolvedor com 6 anos de experiência em web.")).toBe(6);
  });
  it("takes the largest credible claim and ignores absurd ones", () => {
    expect(extractYearsExperience("3 years of experience in React, 8 years of experience overall.")).toBe(8);
    expect(extractYearsExperience("99 years of experience")).toBeNull();
  });
  it("returns null when nothing is stated", () => {
    expect(extractYearsExperience("Built things at Acme Corp.")).toBeNull();
  });
});

describe("extractLanguages", () => {
  it("reads an EN section", () => {
    const cv = "LANGUAGES\nPortuguese (native), English (fluent)\n\nEXPERIENCE\n...";
    const langs = extractLanguages(cv);
    expect(langs.join(" ")).toMatch(/portuguese/i);
    expect(langs.join(" ")).toMatch(/english/i);
  });
  it("reads a PT IDIOMAS section", () => {
    const cv = "IDIOMAS\nPortuguês nativo · Inglês fluente\n\nEXPERIÊNCIA\n...";
    const langs = extractLanguages(cv);
    expect(langs.length).toBeGreaterThanOrEqual(2);
  });
  it("reads inline 'English: Fluent (C1)'", () => {
    expect(extractLanguages("English: Fluent (C1). Portuguese: native speaker.").length).toBeGreaterThanOrEqual(1);
  });
  it("reads inline 'Fluent in English'", () => {
    expect(extractLanguages("Fluent in English; intermediate Japanese.").join(" ")).toMatch(/english/i);
  });
});

describe("extractSkills", () => {
  it("reads a SKILLS section", () => {
    const cv = "SKILLS\nReact, TypeScript, Node.js, PostgreSQL\nDocker · AWS\n\nEDUCATION\n...";
    const skills = extractSkills(cv);
    expect(skills).toContain("React");
    expect(skills).toContain("Docker");
  });
  it("reads a PT HABILIDADES section", () => {
    const cv = "HABILIDADES\nLaravel, Vue.js, MySQL\n\nFORMAÇÃO\n...";
    expect(extractSkills(cv)).toContain("Laravel");
  });
  it("does not swallow prose sentences as skills", () => {
    const cv = "SKILLS\nBuilt many applications for enterprise clients over several years of work\n\nEDUCATION\n...";
    expect(extractSkills(cv)).toEqual([]);
  });
});

describe("extractLinkedinUrl", () => {
  it("finds a bare linkedin.com/in URL and normalises it", () => {
    expect(extractLinkedinUrl("Linkedin: linkedin.com/in/maria-j-dev · GitHub: ...")).toBe(
      "https://linkedin.com/in/maria-j-dev",
    );
  });
  it("keeps an https URL as-is and strips trailing punctuation", () => {
    expect(extractLinkedinUrl("(https://www.linkedin.com/in/k-e-dev).")).toBe(
      "https://www.linkedin.com/in/k-e-dev",
    );
  });
  it("returns null when absent", () => {
    expect(extractLinkedinUrl("GitHub only: github.com/someone")).toBeNull();
  });
});

describe("parseCvFacts", () => {
  it("assembles all four facts from one PT CV", () => {
    const cv = [
      "Maria J.",
      "Desenvolvedora Full Stack com 5 anos de experiência.",
      "Linkedin: linkedin.com/in/maria-j",
      "",
      "HABILIDADES",
      "PHP, Laravel, Vue.js",
      "",
      "IDIOMAS",
      "Português nativo, Inglês intermediário",
    ].join("\n");
    const facts = parseCvFacts(cv);
    expect(facts.years_experience).toBe(5);
    expect(facts.skills).toContain("Laravel");
    expect(facts.languages.length).toBeGreaterThanOrEqual(2);
    expect(facts.linkedin_url).toBe("https://linkedin.com/in/maria-j");
  });
});

describe("isGarbageCvText (audit #3, finding 4)", () => {
  it("flags binary PDF byte soup", async () => {
    const { isGarbageCvText } = await import("@/lib/cv/parse-facts");
    const soup = "M\u0007\u0002\u0019_\u00d2\u00a1\u0001\u0003 \u0004s{\u0005\u0006\u0007 U\u000449 ".repeat(40);
    expect(isGarbageCvText(soup)).toBe(true);
  });
  it("flags replacement-character floods", async () => {
    const { isGarbageCvText } = await import("@/lib/cv/parse-facts");
    expect(isGarbageCvText(("V`F\uFFFD0_\uFFFDO\uFFFD \uFFFD\uFFFD ~,\uFFFD3 ").repeat(30))).toBe(true);
  });
  it("passes a normal English CV", async () => {
    const { isGarbageCvText } = await import("@/lib/cv/parse-facts");
    expect(
      isGarbageCvText(
        "Full Stack Developer with 6+ years of experience building SaaS products. Skills: React, TypeScript, Node.js.".repeat(5),
      ),
    ).toBe(false);
  });
  it("passes a Portuguese CV with accents", async () => {
    const { isGarbageCvText } = await import("@/lib/cv/parse-facts");
    expect(
      isGarbageCvText(
        "Desenvolvedora com 5 anos de experiência em aplicações web. Habilidades: integração, segurança, comunicação.".repeat(5),
      ),
    ).toBe(false);
  });
});

/**
 * Years of experience is how every candidate row shows "N yrs" beneath the
 * name. The pattern required the literal phrase "years of experience" and
 * digits only, so a CV reading "eleven years building production React and
 * TypeScript applications" produced nothing and that candidate's row rendered
 * without the line every other row carried. It read as a rendering bug on one
 * candidate; the parser was declining to read ordinary English.
 */
describe("extractYearsExperience reads how CVs are actually written", () => {
  it("still reads the classic phrasing", () => {
    expect(extractYearsExperience("6+ years of professional experience")).toBe(6);
    expect(extractYearsExperience("9 anos de experiência")).toBe(9);
  });

  it("reads a spelled-out count", () => {
    expect(extractYearsExperience("Eleven years of experience in payments")).toBe(11);
  });

  it("reads years spent DOING the work, not only the words 'of experience'", () => {
    expect(
      extractYearsExperience("eleven years building production React and TypeScript applications"),
    ).toBe(11);
    expect(extractYearsExperience("12 years leading engineering teams")).toBe(12);
  });

  it("takes the largest honest claim", () => {
    expect(
      extractYearsExperience("3 years building APIs. Fifteen years of experience overall."),
    ).toBe(15);
  });

  it("does not count a span of years that is not work", () => {
    // The reason the doing-words are a list rather than "any word".
    expect(extractYearsExperience("Three years at university studying computer science")).toBeNull();
    expect(extractYearsExperience("Left that role two years ago")).toBeNull();
  });

  it("returns nothing when the CV never says", () => {
    expect(extractYearsExperience("Senior engineer. Postgres, React, testing.")).toBeNull();
  });
});
