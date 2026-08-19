import { describe, expect, it } from "vitest";
import { cleanQuote, QUOTE_MAX_CHARS, stripContactLines } from "@/lib/evidence/quote-hygiene";

describe("quote hygiene", () => {
  it("removes emails, spaced phone numbers and URLs", () => {
    const raw =
      "tobias.nkemelu@example.com | (317) 555-0155 | linkedin.com/in/tobiasnk Summary Sales professional with 3 years of B2B experience selling logistics services.";
    const out = cleanQuote(raw);
    expect(out).not.toMatch(/@/);
    expect(out).not.toMatch(/linkedin/i);
    expect(out.replace(/\D/g, "")).not.toMatch(/\d{7}/);
    expect(out).toContain("Sales professional with 3 years");
  });

  it("removes truncated addresses a full email regex misses", () => {
    expect(cleanQuote("Rui Fernandes Full-Stack Engineer Lisbon, Portugal rui.fernandes@demo.")).not.toContain(
      "@",
    );
  });

  it("strips spaced international phone numbers", () => {
    expect(stripContactLines("Sao Paulo, Brazil +55 11 5555 0119 Summary Inside sales")).not.toContain("5555");
  });

  it("snaps to a sentence start when a full sentence follows", () => {
    const out = cleanQuote(
      "ature flags and staged rollouts. Migrated the billing service to Postgres with zero downtime. Data and reporting — designed the reporting schema and the query layer used by every dashboard.",
    );
    expect(out.startsWith("Migrated the billing service")).toBe(true);
  });

  it("marks an unavoidable mid-sentence opening as a continuation", () => {
    const out = cleanQuote("hit target in 9 of 20 months while covering two territories at once.");
    expect(out.startsWith("…")).toBe(true);
  });

  it("does not treat Node.js as a sentence end", () => {
    const out = cleanQuote("Ana Ribeiro Senior Full-Stack Engineer — React, TypeScript, Node.js and PostgreSQL");
    expect(out).not.toMatch(/Node\.$/);
  });

  it("caps at the quote length without cutting a word in half", () => {
    const out = cleanQuote(`Summary ${"delivery ".repeat(60)}`);
    expect(out.length).toBeLessThanOrEqual(QUOTE_MAX_CHARS + 1);
    expect(out).not.toMatch(/deliver…$/);
  });

  it("drops fragments too short to read as a quote", () => {
    expect(cleanQuote("-0155")).toBe("");
    expect(cleanQuote(null)).toBe("");
  });
});
