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
