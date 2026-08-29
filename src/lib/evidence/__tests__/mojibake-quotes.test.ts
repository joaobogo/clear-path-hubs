import { describe, it, expect } from "vitest";
import { isMojibake, renderQuote } from "@/lib/evidence/quote-hygiene";

/**
 * audit #4, item 13 — a CV whose extraction produced byte soup still had its
 * "quotes" rendered as evidence under real requirements, so a candidate no
 * document could be read for appeared to have quoted proof of AI tooling and
 * UX principles.
 */
describe("isMojibake", () => {
  it("catches replacement characters", () => {
    expect(isMojibake("Experienced engineer M���_�ҡ delivery")).toBe(true);
  });

  it("catches control characters from a mis-decoded binary stream", () => {
    expect(isMojibake("Senior engineer with ten years of delivery experience")).toBe(
      true,
    );
  });

  it("catches a passage that is mostly not ordinary text", () => {
    expect(isMojibake("Ø±Çþ¤µÑ¾Ã§¶Ô")).toBe(
      true,
    );
  });

  it("leaves real prose alone", () => {
    expect(
      isMojibake("Led a team of five engineers building a multi-tenant SaaS platform."),
    ).toBe(false);
  });

  it("leaves accented and non-English prose alone", () => {
    // A Portuguese CV is not byte soup.
    expect(
      isMojibake("Especialização em Segurança Cibernética, com foco em proteção de dados."),
    ).toBe(false);
    expect(isMojibake("Criação de interfaces e experiência do usuário em produtos digitais.")).toBe(
      false,
    );
  });

  it("tolerates a single stray replacement character in otherwise good prose", () => {
    expect(
      isMojibake(
        "Led a team of five engineers building a multi-tenant SaaS platform� with per-tenant isolation.",
      ),
    ).toBe(false);
  });
});

describe("renderQuote drops unreadable passages", () => {
  it("returns nothing for byte soup", () => {
    expect(renderQuote("M���_�ҡ�� potato quote text here")).toBe(
      "",
    );
  });

  it("still renders a real quote", () => {
    const out = renderQuote(
      "Comfortable using AI tools to improve development workflows across the team.",
    );
    expect(out).toContain("AI tools");
  });
});
