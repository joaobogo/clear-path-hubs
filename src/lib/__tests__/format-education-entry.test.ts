/**
 * Absent facts must read as absent.
 *
 * The admin candidate tabs joined education fields with a literal separator and
 * placeholder fallbacks, so a record missing a degree showed the word "Degree"
 * where the qualification belongs, and a record with no dates showed a bare em
 * dash (audit #6, A6-29).
 */
import { describe, expect, it } from "vitest";
import { formatEducationEntry } from "@/lib/human-labels";

describe("formatEducationEntry", () => {
  it("joins the parts it has", () => {
    expect(
      formatEducationEntry({
        degree: "BSc Computer Science",
        institution: "UFPR",
        start_date: "2015",
        end_date: "2019",
      }),
    ).toEqual({ headline: "BSc Computer Science · UFPR", period: "2015—2019" });
  });

  it("never invents a degree it was not given", () => {
    const { headline } = formatEducationEntry({ institution: "UFPR" });
    expect(headline).toBe("UFPR");
    expect(headline).not.toMatch(/degree/i);
  });

  it("leaves no dangling separator when the institution is missing", () => {
    const { headline } = formatEducationEntry({ degree: "MEng" });
    expect(headline).toBe("MEng");
  });

  it("falls back to school when institution is absent", () => {
    expect(formatEducationEntry({ degree: "MEng", school: "PUC" }).headline).toBe("MEng · PUC");
  });

  it("reports no period rather than a bare dash", () => {
    expect(formatEducationEntry({ degree: "MEng" }).period).toBeNull();
    expect(formatEducationEntry({ degree: "MEng", start_date: "", end_date: "" }).period).toBeNull();
  });

  it("keeps an open-ended range, which is real information", () => {
    expect(formatEducationEntry({ start_date: "2019" }).period).toBe("2019");
    expect(formatEducationEntry({ end_date: "2019" }).period).toBe("2019");
  });

  it("returns nothing to render for an empty entry", () => {
    expect(formatEducationEntry({})).toEqual({ headline: null, period: null });
    expect(formatEducationEntry(null)).toEqual({ headline: null, period: null });
  });

  it("treats whitespace-only fields as absent", () => {
    expect(formatEducationEntry({ degree: "   ", institution: "UFPR" }).headline).toBe("UFPR");
  });
});
