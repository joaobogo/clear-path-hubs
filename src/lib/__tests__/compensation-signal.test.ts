import { describe, it, expect } from "vitest";
import {
  parseMoneyRange,
  rangeFromRecord,
  classifyAlignment,
  buildCompensationSignal,
} from "@/lib/compensation-signal";

describe("parseMoneyRange", () => {
  it("parses european thousands separators", () => {
    const r = parseMoneyRange("80.000-120.000");
    expect(r?.min).toBe(80000);
    expect(r?.max).toBe(120000);
  });
  it("parses k suffix and currency", () => {
    const r = parseMoneyRange("€80k – 120k per year");
    expect(r?.min).toBe(80000);
    expect(r?.max).toBe(120000);
    expect(r?.currency).toBe("EUR");
    expect(r?.period).toBe("year");
  });
  it("parses a single figure", () => {
    const r = parseMoneyRange("50000");
    expect(r?.min).toBe(50000);
    expect(r?.max).toBeNull();
  });
  it("returns null when there is no figure", () => {
    expect(parseMoneyRange("competitive")).toBeNull();
    expect(parseMoneyRange("")).toBeNull();
  });
});

describe("rangeFromRecord", () => {
  it("reads structured min/max", () => {
    const r = rangeFromRecord({ min: 60000, max: 70000, currency: "usd" });
    expect(r?.min).toBe(60000);
    expect(r?.currency).toBe("USD");
  });
  it("falls back to a free-text note", () => {
    const r = rangeFromRecord({ note: "80.000-120.000" });
    expect(r?.max).toBe(120000);
  });
  it("returns null for an empty record", () => {
    expect(rangeFromRecord({})).toBeNull();
  });
});

describe("classifyAlignment", () => {
  const role = { min: 80000, max: 120000, currency: "EUR", period: null, raw: null };
  const ask = (n: number) => ({ min: n, max: null, currency: "EUR", period: null, raw: null });
  it("marks in range", () => expect(classifyAlignment(role, ask(100000))).toBe("in_range"));
  it("marks above range", () => expect(classifyAlignment(role, ask(150000))).toBe("above_range"));
  it("marks below range", () => expect(classifyAlignment(role, ask(50000))).toBe("below_range"));
  it("is unknown without a candidate figure", () =>
    expect(classifyAlignment(role, null)).toBe("unknown"));
  it("is unknown across currencies", () =>
    expect(
      classifyAlignment(role, { min: 100000, max: null, currency: "USD", period: null, raw: null }),
    ).toBe("unknown"));
});

describe("buildCompensationSignal", () => {
  it("never invents a figure when nothing is on record", () => {
    const s = buildCompensationSignal({
      roleCompensation: {},
      candidateCompensation: {},
      location: "Berlin",
      offerAmounts: [],
    });
    expect(s.dataQuality).toBe("none");
    expect(s.figures.every((f) => f.display === null)).toBe(true);
    expect(s.disclaimer).toMatch(/won't show an estimate/i);
  });

  it("flags thin data for fewer than three real offers", () => {
    const s = buildCompensationSignal({
      roleCompensation: { note: "80.000-120.000" },
      candidateCompensation: { expected: 110000 },
      location: "Berlin, DE",
      offerAmounts: [{ amount: 100000, currency: "EUR", period: "year" }],
    });
    const offers = s.figures.find((f) => f.source === "offers_on_record")!;
    expect(offers.thin).toBe(true);
    expect(offers.note).toMatch(/not a benchmark/i);
    expect(s.alignment).toBe("in_range");
  });

  it("treats three or more offers as history, not a benchmark", () => {
    const s = buildCompensationSignal({
      roleCompensation: { min: 80000, max: 120000, currency: "EUR" },
      candidateCompensation: { expected: 150000 },
      location: null,
      offerAmounts: [90000, 100000, 110000].map((amount) => ({
        amount,
        currency: "EUR",
        period: "year",
      })),
    });
    const offers = s.figures.find((f) => f.source === "offers_on_record")!;
    expect(offers.thin).toBe(false);
    expect(offers.sampleSize).toBe(3);
    expect(s.dataQuality).toBe("on_record");
    expect(s.alignment).toBe("above_range");
    expect(s.disclaimer).toMatch(/Nothing is modelled or benchmarked/i);
  });
});
