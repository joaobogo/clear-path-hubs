/**
 * One canonical case for a path.
 *
 * `/PRICING` served a 200 with the pricing page and a canonical tag pointing at
 * `/pricing` — the tag keeps the duplicate out of the index, but links, shares
 * and analytics fragment across both URLs (audit 18 Sep, TF-C-029).
 *
 * The redirect is deliberately NOT a blanket lowercase. These tests exist
 * mostly to hold that line: lowercasing a share token silently breaks a link
 * somebody sent to a candidate, and that is far worse than the duplicate it
 * would have fixed.
 */
import { describe, expect, it } from "vitest";
import { canonicalPathFor } from "@/start";

describe("an uppercase marketing path redirects to its canonical case", () => {
  it("lowercases the reported case and its neighbours", () => {
    expect(canonicalPathFor("/PRICING")).toBe("/pricing");
    expect(canonicalPathFor("/Pricing")).toBe("/pricing");
    expect(canonicalPathFor("/Blog/Some-Post")).toBe("/blog/some-post");
    expect(canonicalPathFor("/Industries/Healthcare")).toBe("/industries/healthcare");
  });

  it("leaves an already-canonical path alone, so there is no redirect loop", () => {
    for (const p of ["/", "/pricing", "/blog/what-is-talent-as-a-service", "/jobs"]) {
      expect(canonicalPathFor(p), p).toBeNull();
    }
  });
});

describe("paths whose case is not ours to change are never touched", () => {
  it("never rewrites a share token", () => {
    // The whole point: this is an opaque token, and lowercasing it 404s a link
    // that was already sent to someone.
    expect(canonicalPathFor("/share/AbC123XyZ")).toBeNull();
  });

  it("never rewrites application receipts, Lovable routes, the API or assets", () => {
    for (const p of [
      "/apply/received/AbC-123",
      "/lovable/email/auth/Webhook",
      "/api/public/JD-Requirements",
      "/assets/index-DKJkE4Ah.js",
      "/_build/Chunk.mjs",
    ]) {
      expect(canonicalPathFor(p), p).toBeNull();
    }
  });

  it("never rewrites anything with a file extension", () => {
    for (const p of ["/OG-Image.png", "/Sitemap.xml", "/Robots.txt", "/fonts/Brand.woff2"]) {
      expect(canonicalPathFor(p), p).toBeNull();
    }
  });
});
