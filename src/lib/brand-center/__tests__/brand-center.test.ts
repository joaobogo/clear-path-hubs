import { describe, expect, it } from "vitest";
import { detectBrand, ACTIVE_DETECTION } from "@/lib/brand-center/detect";
import {
  ASSETS,
  approvedAssets,
  assetFilename,
  blockedAssets,
  buildManifest,
  manifestCsv,
  reviewAssets,
} from "@/lib/brand-center/registry";
import { isVectorSafe, sceneToSvg } from "@/lib/brand-center/scene";
import { CONTRAST_RESULTS, contrastRatio } from "@/lib/brand-center/palette";
import { WORDS_TO_AVOID } from "@/lib/brand-center/messaging";
import * as T from "@/lib/brand-center/templates";

describe("brand detection", () => {
  it("verifies taasflow from two agreeing signals", () => {
    expect(ACTIVE_DETECTION.status).toBe("verified");
    expect(ACTIVE_DETECTION.brandId).toBe("taasflow");
    expect(ACTIVE_DETECTION.agreeingSignals.length).toBeGreaterThanOrEqual(2);
  });

  it("halts when signals disagree", () => {
    const d = detectBrand({
      configName: "TaaSFlow",
      logoFiles: [],
      hostname: "atlasflow.com",
      explicitBrandId: null,
    });
    expect(d.status).toBe("ambiguous");
    expect(d.brandId).toBeNull();
  });

  it("halts on a single signal", () => {
    const d = detectBrand({ configName: "TaaSFlow", logoFiles: [], hostname: null });
    expect(d.status).toBe("unresolved");
  });
});

describe("asset registry", () => {
  it("every non-blocked asset has artwork and non-zero dimensions", () => {
    for (const asset of ASSETS.filter((a) => a.status !== "blocked")) {
      expect(asset.scene || asset.fileUrl, asset.name).toBeTruthy();
      expect(asset.width, asset.name).toBeGreaterThan(0);
      expect(asset.height, asset.name).toBeGreaterThan(0);
    }
  });

  it("generated scenes match their declared dimensions", () => {
    for (const asset of ASSETS.filter((a) => a.scene)) {
      const scene = asset.scene!();
      expect(`${scene.width}x${scene.height}`, asset.name).toBe(`${asset.width}x${asset.height}`);
    }
  });

  it("follows the filename convention", () => {
    const pattern = /^taasflow_[a-z0-9-]+_[a-z0-9-]+_\d+x\d+_v\d+\.\d+\.(png|svg|ico|html)$/;
    for (const asset of ASSETS.filter((a) => a.status !== "blocked")) {
      for (const format of asset.formats) {
        expect(assetFilename(asset, format), asset.name).toMatch(pattern);
      }
    }
  });

  it("separates approved, review and blocked", () => {
    expect(approvedAssets().length).toBeGreaterThan(0);
    expect(reviewAssets().every((a) => a.status === "review")).toBe(true);
    expect(blockedAssets().every((a) => !a.scene && !a.fileUrl)).toBe(true);
    expect(approvedAssets().some((a) => a.status !== "approved")).toBe(false);
  });

  it("names a source asset for everything it produces", () => {
    for (const asset of ASSETS.filter((a) => a.status !== "blocked")) {
      expect(asset.sourceAssets.length, asset.name).toBeGreaterThan(0);
    }
  });

  it("exports a manifest row per format with a CSV header", () => {
    const rows = buildManifest();
    expect(rows.length).toBe(ASSETS.reduce((n, a) => n + a.formats.length, 0));
    expect(manifestCsv(rows).split("\n")[0]).toContain("filename,category,dimensions");
  });
});

describe("required exact dimensions", () => {
  const required: [string, number, number][] = [
    ["linkedin-company", 1128, 191],
    ["linkedin-personal", 1584, 396],
    ["linkedin-profile-image", 400, 400],
    ["x-header", 1500, 500],
    ["facebook-cover", 820, 312],
    ["youtube-channel-art", 2560, 1440],
    ["open-graph", 1200, 630],
    ["instagram-square", 1080, 1080],
    ["instagram-portrait", 1080, 1350],
    ["instagram-story", 1080, 1920],
    ["presentation-title", 1920, 1080],
  ];

  it.each(required)("%s is %ix%i", (assetId, w, h) => {
    const found = ASSETS.filter((a) => a.assetId === assetId);
    expect(found.length).toBeGreaterThan(0);
    for (const a of found) {
      expect(a.width).toBe(w);
      expect(a.height).toBe(h);
    }
  });

  it("ships three distinct LinkedIn company headers and three personal banners", () => {
    const company = ASSETS.filter((a) => a.assetId === "linkedin-company");
    const personal = ASSETS.filter((a) => a.assetId === "linkedin-personal");
    expect(company).toHaveLength(3);
    expect(personal).toHaveLength(3);
    for (const set of [company, personal]) {
      const svgs = set.map((a) => sceneToSvg(a.scene!()));
      expect(new Set(svgs).size).toBe(3);
      // distinct structure, not just a recolour: node counts differ
      const counts = set.map((a) => a.scene!().nodes.length);
      expect(new Set(counts).size).toBeGreaterThan(1);
    }
  });
});

describe("scene rendering", () => {
  it("serializes to SVG with the declared viewBox", () => {
    const scene = T.ogImage();
    const svg = sceneToSvg(scene);
    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("marks raster-bearing scenes as not vector safe", () => {
    expect(isVectorSafe(T.ogImage())).toBe(false);
    expect(isVectorSafe(T.gridDiagram())).toBe(true);
  });

  it("escapes text content", () => {
    const svg = sceneToSvg({
      width: 10, height: 10, background: "#fff",
      nodes: [{ t: "text", x: 0, y: 0, text: "a & b <c>", size: 10 }],
    });
    expect(svg).toContain("a &amp; b &lt;c&gt;");
  });
});

describe("accessibility and copy", () => {
  it("computes contrast ratios that match known values", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBe(21);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1);
  });

  it("reports pass/fail as data, not colour", () => {
    for (const r of CONTRAST_RESULTS) {
      expect(typeof r.normalAA).toBe("boolean");
      expect(typeof r.largeAA).toBe("boolean");
      expect(r.ratio).toBeGreaterThan(0);
    }
  });

  it("never uses a forbidden phrase in generated asset copy", () => {
    const banned = ["revolutionary", "world-class", "best-in-class", "one-stop shop", "seamless", "game-changing", "guaranteed", "AI score", "free trial"];
    const allText = ASSETS.filter((a) => a.scene)
      .flatMap((a) => a.scene!().nodes)
      .filter((n) => n.t === "text")
      .map((n) => (n as { text: string }).text.toLowerCase())
      .join(" | ");
    for (const phrase of banned) {
      expect(allText, phrase).not.toContain(phrase.toLowerCase());
    }
    expect(WORDS_TO_AVOID.length).toBeGreaterThan(5);
  });

  it("uses only verified URLs in artwork", () => {
    const urls = ASSETS.filter((a) => a.scene)
      .flatMap((a) => a.scene!().nodes)
      .filter((n) => n.t === "text")
      .map((n) => (n as { text: string }).text)
      .filter((t) => /\.(com|io|ai|co)\b/.test(t));
    for (const u of urls) {
      expect(u.startsWith("taasflow.com")).toBe(true);
    }
  });
});
