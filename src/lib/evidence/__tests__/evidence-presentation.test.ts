import { describe, it, expect } from "vitest";
import { presentEvidenceList, stripSectionHeading } from "@/lib/evidence/evidence-presentation";

describe("evidence presentation", () => {
  it("strips whole and sliced section headings", () => {
    expect(stripSectionHeading("SUMMARY Eight years building payment platforms across Europe.").text)
      .toBe("Eight years building payment platforms across Europe.");
    expect(stripSectionHeading("TORY Senior Software Engineer at Northwind, 2019-2022, owned billing.").section)
      .toBe("Employment history");
    expect(stripSectionHeading("NGUAGES - Portuguese (native), English (C2), Spanish conversational").section)
      .toBe("Languages");
  });
  it("collapses near-identical snippets and the summary line", () => {
    const out = presentEvidenceList(
      [
        { snippet: "Eight years building production React and TypeScript applications for fintech." },
        { snippet: "Eight years building production React and TypeScript applications for fintech clients across Europe." },
      ],
      [],
    );
    expect(out).toHaveLength(1);
    const withSummary = presentEvidenceList(
      [{ snippet: "Eight years building production React and TypeScript applications for fintech." }],
      ["Eight years building production React and TypeScript applications for fintech."],
    );
    expect(withSummary).toHaveLength(0);
  });
  it("names section, employer and dates in the source line", () => {
    const [item] = presentEvidenceList(
      [{ snippet: "TORY Senior Software Engineer at Northwind 2019-2022 owned the billing platform end to end.", source: "cv:120-260" }],
      [],
    );
    expect(item.sourceLine).toContain("Curriculum Vitae");
    expect(item.sourceLine).toContain("Employment history");
    expect(item.sourceLine).toContain("Northwind");
    expect(item.sourceLine).toContain("2019–2022");
  });
  it("shows no quote when only a fragment remains", () => {
    expect(presentEvidenceList([{ snippet: "NGUAGES -" }], [])).toHaveLength(0);
  });
});
