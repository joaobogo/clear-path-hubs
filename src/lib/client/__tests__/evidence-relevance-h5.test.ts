import { describe, it, expect } from "vitest";
import { passageSupportsRequirement } from "@/lib/client/evidence-relevance";

/**
 * audit #4, H5 — quotes shown to a client under "Meets this" did not support
 * the requirement beside them. Every string here is taken from the audit.
 */
describe("passageSupportsRequirement — H5 false positives", () => {
  it("a frontend passage does not prove web security", () => {
    expect(
      passageSupportsRequirement(
        "ES6+ FRONTEND: Full Stack Developer with hands-on experience building web applications using React, TypeScript, Node.js, Express, and PostgreSQL.",
        "Understanding of practical web security fundamentals",
      ),
    ).toBe(false);
  });

  it("understanding CLIENT REQUIREMENTS does not prove UX/UI principles", () => {
    expect(
      passageSupportsRequirement(
        "Worked with clients to understand requirements, troubleshoot issues, and support successful platform adoption.",
        "Understanding of good UX/UI principles",
      ),
    ).toBe(false);
  });

  it("still accepts the passage that actually names the subject", () => {
    expect(
      passageSupportsRequirement(
        "Applied web security fundamentals across the stack, including CSRF protection and content security policy.",
        "Understanding of practical web security fundamentals",
      ),
    ).toBe(true);
  });
});

/**
 * The M14 behaviour these rules must not undo: a named discipline is specific
 * enough on its own, including through the engine's synonym table, so a
 * Portuguese CV keeps the evidence the run credited it with.
 */
describe("passageSupportsRequirement — M14 must not regress", () => {
  it("UX still matches its Portuguese synonym", () => {
    expect(
      passageSupportsRequirement(
        "Criação de interfaces e foco na experiência do usuário em produtos digitais.",
        "Understanding of good UX/UI principles",
      ),
    ).toBe(true);
  });

  it("security still matches its Portuguese synonym", () => {
    expect(
      passageSupportsRequirement(
        "Especialização em Segurança Cibernética com foco em proteção de dados.",
        "Understanding of practical web security fundamentals",
      ),
    ).toBe(true);
  });

  it("two weak terms together are enough", () => {
    expect(
      passageSupportsRequirement(
        "Built REST APIs on a Node service handling web traffic at scale.",
        "Experience with web APIs",
      ),
    ).toBe(true);
  });

  it("a requirement with nothing specific to check against is not blocked", () => {
    // Every token is generic, so there is no subject to test the passage on.
    expect(
      passageSupportsRequirement("Any passage at all here.", "Experience working with the team"),
    ).toBe(true);
  });

  it("a two-letter subject must match as a whole word, not inside another", () => {
    // "ui" lives inside "requirements" and "building"; neither is UI work.
    expect(
      passageSupportsRequirement(
        "Responsible for building out the requirements with stakeholders.",
        "Understanding of good UX/UI principles",
      ),
    ).toBe(false);
  });
});
