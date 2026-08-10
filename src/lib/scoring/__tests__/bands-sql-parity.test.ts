import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SCORE_BAND_BOUNDARIES,
  buildScoreBandSql,
  classifyBand,
} from "../bands";

const sqlPath = resolve(process.cwd(), "src/lib/scoring/score-band.sql");
const checkedIn = readFileSync(sqlPath, "utf8");

describe("score_band SQL parity", () => {
  it("checked-in SQL matches the generator byte-for-byte", () => {
    expect(checkedIn).toBe(buildScoreBandSql());
  });

  it("every boundary in the TS table appears in the SQL", () => {
    for (const b of SCORE_BAND_BOUNDARIES) {
      if (b.min > 0) {
        expect(checkedIn).toContain(
          `WHEN _score >= ${b.min} THEN '${b.key}'::public.score_band`,
        );
      }
    }
  });

  it("SQL contains no threshold the TS table does not own", () => {
    const sqlThresholds = [...checkedIn.matchAll(/_score >= (\d+)/g)]
      .map((m) => Number(m[1]))
      .sort((a, b) => b - a);
    const tsThresholds = SCORE_BAND_BOUNDARIES.filter((b) => b.min > 0).map(
      (b) => b.min,
    );
    expect(sqlThresholds).toEqual(tsThresholds);
  });

  it("SQL band vocabulary matches classifyBand at each boundary edge", () => {
    for (const b of SCORE_BAND_BOUNDARIES) {
      expect(classifyBand(b.min)).toBe(b.key);
    }
    expect(classifyBand(null)).toBe("unscored");
  });
});
