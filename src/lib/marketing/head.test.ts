import { describe, expect, it } from "vitest";
import { clampDescription, clampTitle, marketingHead } from "@/lib/marketing/head";

describe("clampTitle", () => {
  it("leaves a title that already fits untouched", () => {
    expect(clampTitle("Accounting hiring — TaaSFlow")).toBe("Accounting hiring — TaaSFlow");
  });

  it("drops the subtitle rather than truncating mid-word", () => {
    expect(
      clampTitle("Accounting Hiring Benchmarks 2026: Time-to-Fill, Cost & Attrition"),
    ).toBe("Accounting Hiring Benchmarks 2026");
  });

  it("keeps the longest leading segment that still fits", () => {
    expect(
      clampTitle("Skills-Based Hiring: How to Drop Degree Requirements Without Lowering the Bar"),
    ).toBe("Skills-Based Hiring");
  });

  it("falls back to a word-boundary ellipsis when there is no segment break", () => {
    const out = clampTitle("How to Reduce Time-to-Hire by 50% Without Sacrificing Quality");
    expect(out.length).toBeLessThan(60);
    expect(out.endsWith("…")).toBe(true);
    expect(out).toBe("How to Reduce Time-to-Hire by 50% Without Sacrificing…");
  });

  it("never returns a stub segment", () => {
    // "2026" fits but says nothing, so the word-boundary path wins instead.
    expect(clampTitle("2026: The Complete Guide to Hiring Engineers in a Tight Market")).toContain(
      "Complete Guide",
    );
  });
});

describe("marketingHead", () => {
  const entry = {
    markdown: "",
    meta: {
      title: "Salary Trends 2026: Comprehensive Compensation Report Across 15 Industries",
      description: "x".repeat(400),
      "og:type": "article",
    },
  } as unknown as Parameters<typeof marketingHead>[0];

  it("emits every required tag inside SERP limits", () => {
    const head = marketingHead(entry, "/blog/salary-trends-2026");
    const byName = (name: string) =>
      head.meta.find((m) => "name" in m && m.name === name) as { content: string } | undefined;
    const byProp = (prop: string) =>
      head.meta.find((m) => "property" in m && m.property === prop) as
        | { content: string }
        | undefined;
    const title = (head.meta.find((m) => "title" in m) as { title: string }).title;

    expect(title).toBe("Salary Trends 2026");
    expect(title.length).toBeLessThan(60);
    expect(byName("description")!.content.length).toBeLessThan(160);
    expect(byProp("og:title")!.content).toBe(title);
    expect(byProp("og:description")!.content).toBe(byName("description")!.content);
    expect(byProp("og:type")!.content).toBe("article");
    expect(byName("twitter:card")!.content).toBe("summary");
  });

  it("promotes a hero image to an absolute og:image/twitter:image pair", () => {
    const head = marketingHead(entry, "/blog/salary-trends-2026", undefined, {
      image: "/assets/hero-abc123.jpg",
    });
    const byName = (name: string) =>
      head.meta.find((m) => "name" in m && m.name === name) as { content: string } | undefined;
    const byProp = (prop: string) =>
      head.meta.find((m) => "property" in m && m.property === prop) as
        | { content: string }
        | undefined;
    expect(byProp("og:image")!.content).toBe("https://taasflow.com/assets/hero-abc123.jpg");
    expect(byName("twitter:image")!.content).toBe(byProp("og:image")!.content);
    expect(byName("twitter:card")!.content).toBe("summary_large_image");

    expect(head.links[0]!.href).toContain("/blog/salary-trends-2026");
  });
});

describe("clampDescription", () => {
  it("keeps descriptions under the rendered length", () => {
    expect(clampDescription("y".repeat(400)).length).toBeLessThan(160);
  });
});
