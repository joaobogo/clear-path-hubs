import { describe, expect, it } from "vitest";
import { renderQuote } from "../quote-hygiene";

describe("renderQuote — opening fragments (F9)", () => {
  it("drops a truncated all-caps heading fragment", () => {
    const out = renderQuote("NGUAGES - Portuguese - native, English - fluent, Spanish - conversational, French - basic reading");
    expect(out.startsWith("Portuguese")).toBe(true);
    expect(out).not.toContain("NGUAGES");
  });

  it("drops a short all-caps fragment before prose", () => {
    const out = renderQuote("TORY Senior Software Engineer at Acme Corp, leading the buyer console rebuild from the ground up");
    expect(out.startsWith("Senior Software Engineer")).toBe(true);
    expect(out).not.toContain("TORY");
  });

  it("drops a truncated year fragment", () => {
    const out = renderQuote("020 - Moved the buyer console to a modular architecture, cutting release time from weeks to days");
    expect(out.startsWith("Moved")).toBe(true);
    expect(out).not.toContain("020");
  });

  it("keeps legitimate all-caps opening words", () => {
    const out = renderQuote("SQL and PostgreSQL used daily for relational modeling across production services and reporting pipelines");
    expect(out.startsWith("SQL")).toBe(true);
  });

  it("keeps legitimate CV headings intact", () => {
    const out = renderQuote("LANGUAGES - Portuguese (native), English (fluent), Spanish (conversational), French (basic)");
    expect(out.startsWith("LANGUAGES")).toBe(true);
  });

  it("keeps real years at the start of a quote", () => {
    const out = renderQuote("2020 - Moved the buyer console to a modular architecture, cutting release time from weeks to days");
    expect(out.startsWith("2020")).toBe(true);
  });
});

describe("renderQuote — CV masthead debris (audit S-07)", () => {
  it("rejects a letter-spaced PDF name banner outright", () => {
    // Live finding: a candidate's spaced-out masthead was quoted as evidence
    // of "fluent professional English".
    const out = renderQuote(
      "E L O P E R T E C H N I C A L P R O D U C T D E V E L O P E R PROFESSIONAL EXPERIENCE Curitiba - PR CONTACT",
    );
    expect(out).not.toMatch(/[A-Z] [A-Z] [A-Z]/);
  });

  it("collapses a letter-spaced run inside otherwise real prose", () => {
    const out = renderQuote(
      "T E C H N I C A L P R O D U C T D E V E L O P E R Built and shipped integrations for enterprise clients across four markets with weekly releases",
    );
    expect(out).toContain("Built and shipped integrations");
    expect(out).not.toMatch(/[A-Z] [A-Z] [A-Z]/);
  });

  it("rejects a link-hub strip as evidence", () => {
    // "GitHub Portfolio Email LinkedIn" carries zero evidence for anything.
    const out = renderQuote(
      "FULL STACK DEVELOPER INTEGRATIONS & PRODUCT DEVELOPMENT GitHub Portfolio Email LinkedIn",
    );
    expect(out).toBe("");
  });

  it("keeps prose that merely mentions the platforms", () => {
    const out = renderQuote(
      "Built the company's GitHub automation and the LinkedIn integration used by the recruiting team for sourcing and outreach",
    );
    expect(out).toContain("GitHub automation");
  });
});
