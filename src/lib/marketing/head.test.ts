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
    // Every marketing page ships a share image (page hero or the branded default),
    // so the card type is always the large-image variant.
    expect(byName("twitter:card")!.content).toBe("summary_large_image");
    expect(byProp("og:image")!.content).toMatch(/^https:\/\/taasflow\.com\//);
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

describe("head length warnings (P12)", () => {
  it("reports when a title or description had to be shortened, with the original", async () => {
    const { clampTitleDetailed, clampDescriptionDetailed, lengthWarnings } = await import(
      "@/lib/marketing/head"
    );
    const t = clampTitleDetailed("Skills-Based Hiring: How to Drop Degree Requirements Without Lowering the Bar");
    const d = clampDescriptionDetailed("word ".repeat(60));
    expect(t.clamped).toBe(true);
    expect(t.original).toContain("Without Lowering the Bar");
    const warnings = lengthWarnings({ title: t, description: d }, "/x");
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("Without Lowering the Bar");
    expect(lengthWarnings({ title: clampTitleDetailed("Short"), description: clampDescriptionDetailed("Short") }, "/x")).toEqual([]);
  });

  it("lets the content entry win over the route fallback", () => {
    const entry = { markdown: "", meta: { title: "Entry title", description: "Entry description" } } as unknown as Parameters<typeof marketingHead>[0];
    const head = marketingHead(entry, "/p", { title: "Fallback title", description: "Fallback description" });
    expect((head.meta.find((m) => "title" in m) as { title: string }).title).toBe("Entry title");
  });
});

describe("structured data scoping (P13)", () => {
  const types = (path: string) =>
    (marketingHead(undefined, path, { title: "T", description: "D" }).scripts ?? []).map(
      (s) => JSON.parse(s.children)["@type"],
    );

  it("emits WebApplication only on /how-it-works", () => {
    expect(types("/how-it-works")).toContain("WebApplication");
    expect(types("/")).not.toContain("WebApplication");
    expect(types("/pricing")).not.toContain("WebApplication");
  });

  it("adds the pilot Offer to the pricing Service, with no per-position prices", async () => {
    const { serviceScript } = await import("@/lib/marketing/head");
    const svc = JSON.parse(serviceScript({ name: "n", description: "d", path: "/pricing" }).children);
    expect(svc.offers).toMatchObject({ "@type": "Offer", price: "699", priceCurrency: "USD" });
    expect(Object.keys(svc.offers)).not.toContain("priceSpecification");
    const other = JSON.parse(serviceScript({ name: "n", description: "d", path: "/pilot" }).children);
    expect(other.offers).toBeUndefined();
  });

  it("emits a robots directive only when asked", () => {
    const has = (h: ReturnType<typeof marketingHead>) =>
      h.meta.some((m) => "name" in m && m.name === "robots");
    expect(has(marketingHead(undefined, "/a", { title: "T", description: "D" }))).toBe(false);
    expect(has(marketingHead(undefined, "/a", { title: "T", description: "D" }, { robots: "noindex, follow" }))).toBe(true);
  });
});
