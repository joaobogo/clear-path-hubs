import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allowedAiPageStrings,
  AI_PAGE_LEAD,
  AI_SECTIONS,
  AI_LAWS,
  AI_LAWS_INTRO,
} from "@/config/ai-in-hiring";
import { HUMAN_OVERSIGHT_NOTE, RECORDS_NOTE } from "@/config/offer-facts";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("/ai-in-hiring content", () => {
  const strings = allowedAiPageStrings();

  it("leads with the shared human-oversight note and the shared records note", () => {
    expect(AI_PAGE_LEAD).toBe(HUMAN_OVERSIGHT_NOTE);
    const retention = AI_SECTIONS.find((s) => s.id === "retention");
    expect(retention?.paragraphs).toContain(RECORDS_NOTE);
  });

  it("makes no claim that nothing in the code supports", () => {
    const text = strings.join(" ").toLowerCase();
    for (const banned of [
      "bias-free",
      "unbiased",
      "bias audit",
      "audited",
      "guarantee",
      "never used to train",
      "do not train",
      "compliant",
      "protected characteristic",
      "postcode",
      "certified",
    ]) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it("names the laws only as a pointer, with a not-legal-advice caveat", () => {
    expect(AI_LAWS_INTRO).toMatch(/not legal advice/i);
    expect(AI_LAWS.length).toBeGreaterThan(0);
  });

  it("has no placeholders", () => {
    for (const s of strings) {
      expect(s).not.toMatch(/\[[^\]]*\]/);
      expect(s.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("/ai-in-hiring route renders only constants", () => {
  const src = read("src/routes/ai-in-hiring.tsx");

  it("registers the route and the required title", () => {
    expect(src).toContain('createFileRoute("/ai-in-hiring")');
    expect(src).toContain("How AI Is Used in Hiring | TaaSFlow");
    expect(src).toContain("breadcrumbs");
  });

  it("has no JSX text literals other than the eyebrow", () => {
    const literals = [...src.matchAll(/>([^<>{}]+)</g)]
      .map((m) => m[1].replace(/\s+/g, " ").trim())
      .filter((t) => /[A-Za-z]{3}/.test(t));
    expect(literals.filter((t) => t !== "AI and your data")).toEqual([]);
  });
});

describe("legal and trust copy is final", () => {
  const files = [
    "src/content/pages/privacy.json",
    "src/content/pages/terms.json",
    "src/routes/privacy.tsx",
    "src/routes/terms.tsx",
    "src/routes/security.tsx",
    "src/routes/trust.tsx",
    "src/config/trust-center.ts",
  ];
  for (const f of files) {
    it(`${f} has no bracketed placeholders or review notes`, () => {
      const raw = read(f);
      // Markdown links like [label](/path) are fine; bare [Placeholder] is not.
      const body = raw.replace(/\[[^\]\n]*\]\(/g, "(");
      const text = f.endsWith(".json") ? (JSON.parse(raw).markdown as string).replace(/\[[^\]\n]*\]\(/g, "(") : body;
      if (f.endsWith(".json")) {
        expect(text).not.toMatch(/\[[A-Z][^\]\n]*\]/);
      } else {
        expect(text).not.toMatch(/\[[A-Z][^\]\n]*\]\s*[,.]?\s*(?!=)/);
      }
      expect(raw).not.toMatch(/pending legal review/i);
      expect(raw).not.toMatch(/pending review by/i);
      expect(raw).not.toMatch(/under counsel review/i);
      expect(raw).not.toMatch(/Internal Review Note/i);
    });
  }

  it("trust page has no dead Founders link or try-before-you-buy wording", () => {
    const t = read("src/routes/trust.tsx");
    expect(t).not.toMatch(/Founders/);
    expect(t).not.toMatch(/try before you buy|no strings/i);
    expect(t).toContain("RECORDS_NOTE");
  });
});
