import { describe, expect, it } from "vitest";
import { markdownToInlineMarkup, parseInlineMarkup } from "@/lib/marketing/inline-format";

/**
 * audit #6, A6-14 — the OmniFlow role brief rendered "# Technical Product
 * Developer – Full Stack & Integrations", "**Junior to Mid-Level | Brazil |
 * Full-Time**" and "## About the Role" as literal text, on a client-facing
 * page and on the public job page.
 */
const plain = (s: string) => parseInlineMarkup(s).map((x) => x.text).join("");

describe("markdownToInlineMarkup", () => {
  it("turns headings into bold lines", () => {
    expect(markdownToInlineMarkup("# Technical Product Developer")).toBe(
      "<strong>Technical Product Developer</strong>",
    );
    expect(markdownToInlineMarkup("## About the Role")).toBe("<strong>About the Role</strong>");
  });

  it("turns emphasis into the permitted tags", () => {
    expect(markdownToInlineMarkup("**Junior to Mid-Level | Brazil | Full-Time**")).toBe(
      "<strong>Junior to Mid-Level | Brazil | Full-Time</strong>",
    );
    expect(markdownToInlineMarkup("this is *important* work")).toBe(
      "this is <em>important</em> work",
    );
  });

  it("turns bullets into readable list lines", () => {
    expect(markdownToInlineMarkup("- First\n- Second")).toBe("• First\n• Second");
  });

  it("keeps a link's label and drops its target", () => {
    expect(markdownToInlineMarkup("See [our handbook](https://example.com/x) for detail")).toBe(
      "See our handbook for detail",
    );
  });

  describe("does not mangle ordinary text", () => {
    it("leaves a mid-sentence hash alone", () => {
      expect(markdownToInlineMarkup("Experience with C# and .NET")).toBe(
        "Experience with C# and .NET",
      );
    });

    it("leaves arithmetic and snake_case alone", () => {
      expect(markdownToInlineMarkup("Roughly 2 * 3 * 4 records")).toBe("Roughly 2 * 3 * 4 records");
      expect(markdownToInlineMarkup("the user_id_column is indexed")).toBe(
        "the user_id_column is indexed",
      );
    });

    it("leaves prose with no markdown untouched", () => {
      const s = "We are hiring a full-stack developer for a Brazil-based team.";
      expect(markdownToInlineMarkup(s)).toBe(s);
    });
  });
});

describe("parseInlineMarkup applies it at render", () => {
  it("never renders markdown syntax as visible text", () => {
    const brief =
      "# Technical Product Developer\n**Junior to Mid-Level | Brazil**\n## About the Role\nYou will ship features.";
    const out = plain(brief);
    expect(out).not.toContain("#");
    expect(out).not.toContain("**");
    expect(out).toContain("Technical Product Developer");
    expect(out).toContain("About the Role");
    expect(out).toContain("You will ship features.");
  });

  it("marks the heading run as bold", () => {
    const segs = parseInlineMarkup("## About the Role");
    expect(segs.some((s) => s.bold && s.text.includes("About the Role"))).toBe(true);
  });

  it("still honours the stored HTML tags it always supported", () => {
    const segs = parseInlineMarkup("plain <strong>bold</strong> plain");
    expect(segs.some((s) => s.bold && s.text === "bold")).toBe(true);
  });
});
