import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = "scripts/check-public-vocabulary.mjs";

function run(args: string[] = []) {
  return spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
}

/** Writes a throwaway surface dir and scans only that. */
function scanFixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "vocab-"));
  try {
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(join(dir, name, ".."), { recursive: true });
      writeFileSync(join(dir, name), body, "utf8");
    }
    return run([dir]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("public vocabulary guard", () => {
  it("passes on the current public surfaces", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("fails the build on agency-dominant self-description", () => {
    const result = scanFixture({
      "bad.tsx": `export const copy = "Our recruiters run a weekly delivery cadence with a dedicated pod.";`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("our-recruiters");
    expect(result.stderr).toContain("delivery-cadence");
    expect(result.stderr).toContain("recruiting-pod");
  });

  it("flags banned phrasing inside page content snapshots", () => {
    const result = scanFixture({
      "page.json": JSON.stringify({
        meta: { description: "Pricing and delivery cadence." },
        markdown: "We source talent wherever it lives.",
      }),
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("meta.description");
    expect(result.stderr).toContain("markdown");
  });

  it("allows honest comparison to agencies and reviewed exceptions", () => {
    const result = scanFixture({
      "ok.tsx": `export const copy = [
        "Unlike a traditional agency, TaaSFlow is an AI hiring intelligence platform.",
        "Reduce time your recruiters spend on top-of-funnel work.",
        "Built for agencies and in-house recruiters alike.",
      ];`,
      "exception.tsx": `export const legacy = "our recruiters"; // vocabulary-allow: quoting a customer`,
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("does not report imports or code comments", () => {
    const result = scanFixture({
      "code.tsx": [
        `import { pod } from "@/lib/delivery-cadence";`,
        `// our recruiters used to be the product`,
        `/* delivery cadence */`,
      ].join("\n"),
    });
    expect(result.status).toBe(0);
  });
});
