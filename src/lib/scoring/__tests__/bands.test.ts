import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  SCORE_BAND_BOUNDARIES,
  bandToFitLabel,
  bandToTier,
  buildScoreBandSql,
  classifyBand,
} from "../bands";
import { classifyScoreBand } from "@/config/scoring-bands";
import { toFitPresentation } from "@/lib/client-fit-presentation";
import { scoreBand } from "@/lib/status-system";

const SQL_PATH = path.join(process.cwd(), "src/lib/scoring/score-band.sql");
const sql = readFileSync(SQL_PATH, "utf8");

/**
 * Evaluates the checked-in SQL band function the way Postgres would: parse the
 * CASE branches out of the shipped SQL and apply them in order. If SQL and TS
 * ever disagree about a boundary, the assertion below fails.
 */
function sqlBandOf(score: number | null): string {
  if (score === null) return "unscored";
  const branches = [...sql.matchAll(/WHEN _score >= (\d+) THEN '([a-z_]+)'/g)].map((m) => ({
    min: Number(m[1]),
    band: m[2]!,
  }));
  const fallback = /ELSE '([a-z_]+)'/.exec(sql)?.[1];
  expect(branches.length).toBeGreaterThan(0);
  expect(fallback).toBeTruthy();
  for (const b of branches) if (score >= b.min) return b.band;
  return fallback!;
}

describe("canonical band table", () => {
  it("ships SQL generated from the TypeScript boundaries", () => {
    expect(sql).toBe(buildScoreBandSql());
  });

  it("produces the same band in TypeScript and in SQL for every score", () => {
    for (let score = 0; score <= 100; score += 1) {
      expect(sqlBandOf(score), `score ${score}`).toBe(classifyBand(score));
    }
    expect(sqlBandOf(null)).toBe(classifyBand(null));
  });

  it("agrees at each boundary and one point below it", () => {
    for (const { key, min } of SCORE_BAND_BOUNDARIES) {
      expect(classifyBand(min)).toBe(key);
      expect(sqlBandOf(min)).toBe(key);
      if (min > 0) expect(classifyBand(min - 0.01)).not.toBe(key);
    }
  });

  it("treats unscorable input as unscored, never as a real band", () => {
    for (const v of [null, undefined, Number.NaN]) {
      expect(classifyBand(v as number | null)).toBe("unscored");
      expect(bandToFitLabel(classifyBand(v as number | null))).toBe("unknown");
      expect(bandToTier(classifyBand(v as number | null))).toBeNull();
    }
  });
});

describe("every surface derives from the canonical table", () => {
  const samples = [0, 20, 49, 50, 69, 70, 84, 85, 94, 95, 100];

  it("presentation config keys match classifyBand", () => {
    for (const s of samples) expect(classifyScoreBand(s).key).toBe(classifyBand(s));
  });

  it("status chips match the canonical tier mapping", () => {
    for (const s of samples) expect(scoreBand(s)).toBe(bandToTier(classifyBand(s)));
  });

  it("client fit presentation never crosses a canonical boundary", () => {
    // 84 and 85 are different canonical bands, so the client band must differ.
    expect(toFitPresentation(null, 84).band).not.toBe(toFitPresentation(null, 95).band);
    // Inside one canonical band the client band is stable.
    expect(toFitPresentation(null, 70).band).toBe(toFitPresentation(null, 84).band);
    expect(toFitPresentation(null, 50).band).toBe(toFitPresentation(null, 69).band);
  });
});
