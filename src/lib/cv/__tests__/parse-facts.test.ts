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
