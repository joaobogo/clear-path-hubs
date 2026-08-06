/**
 * Golden-score regression gate (Prompt 13).
 *
 * Any change to the scoring engine, a calibration/rubric default or the band
 * table must print a diff of every affected fixture and FAIL, until the new
 * behaviour is explicitly accepted:
 *
 *   ACCEPT_GOLDEN=1 bunx vitest run src/lib/scoring/__tests__/golden-scores.test.ts
 *
 * That rewrites golden/score-corpus.json, which is reviewed like any other
 * change. Silent scoring drift is therefore impossible.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  computeGoldenSnapshot,
  diffGolden,
  type GoldenSnapshot,
} from "../golden-runner";

const GOLDEN_PATH = join(__dirname, "golden", "score-corpus.json");
const ACCEPT = process.env["ACCEPT_GOLDEN"] === "1";

function writeGolden(snapshot: GoldenSnapshot) {
  mkdirSync(dirname(GOLDEN_PATH), { recursive: true });
  writeFileSync(GOLDEN_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

describe("golden score regression gate", () => {
  const current = computeGoldenSnapshot();

  it("has an accepted golden snapshot on disk", () => {
    if (!existsSync(GOLDEN_PATH)) {
      writeGolden(current);
      // eslint-disable-next-line no-console
      console.log(`Created golden snapshot at ${GOLDEN_PATH}`);
    }
    expect(existsSync(GOLDEN_PATH)).toBe(true);
  });

  it("covers the whole fixture corpus", () => {
    expect(current.fixtures.length).toBeGreaterThanOrEqual(30);
  });

  it("every fixture score matches the accepted golden values", () => {
    const accepted = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as GoldenSnapshot;
    const diffs = diffGolden(accepted, current);

    if (diffs.length > 0 && ACCEPT) {
      writeGolden(current);
      // eslint-disable-next-line no-console
      console.log(
        [
          `Accepted ${diffs.length} golden change(s):`,
          ...diffs.map((d) => `  ${d}`),
        ].join("\n"),
      );
      return;
    }

    expect(
      diffs,
      diffs.length === 0
        ? ""
        : [
            "",
            `Scoring behaviour changed in ${diffs.length} place(s):`,
            ...diffs.map((d) => `  ${d}`),
            "",
            "If this change is intended, accept it explicitly:",
            "  ACCEPT_GOLDEN=1 bunx vitest run src/lib/scoring/__tests__/golden-scores.test.ts",
            "",
          ].join("\n"),
    ).toEqual([]);
  });
});
