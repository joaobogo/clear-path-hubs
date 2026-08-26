/**
 * Calibration targets for the Northwind demo cohort.
 *
 * Data only: the band each candidate should land in and the intended status of
 * each must-have (R1-R6) and preferred (P1-P4) requirement. The seeder reports
 * the engine's actual result against these; nothing here influences scoring.
 *
 * M = met, P = partial, X = not evidenced.
 */
import type { Verdict } from "./types";

export type CohortTarget = {
  band: "exceptional" | "top" | "strong" | "consider" | "not_recommended" | "disqualified";
  /** null for the disqualified candidate, whose requirement statuses are not asserted. */
  verdicts:
    | Record<"R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "P1" | "P2" | "P3" | "P4", Verdict>
    | null;
};

const v = (musts: string, prefs: string): CohortTarget["verdicts"] => {
  const m = musts.split("") as Verdict[];
  const p = prefs.split("") as Verdict[];
  return {
    R1: m[0], R2: m[1], R3: m[2], R4: m[3], R5: m[4], R6: m[5],
    P1: p[0], P2: p[1], P3: p[2], P4: p[3],
  };
};

export const TARGETS: Record<string, CohortTarget> = {
  "helena-carvalho": { band: "exceptional", verdicts: v("MMMMMM", "MMPM") },
  "tomas-ferreira": { band: "top", verdicts: v("MMMMMM", "MXPM") },
  "mariana-lopes": { band: "top", verdicts: v("MMMMPM", "MMXP") },
  "rui-almeida": { band: "strong", verdicts: v("MMMPMM", "PXXM") },
  "marta-nunes": { band: "top", verdicts: v("MMMMMM", "XPXP") },
  "diogo-martins": { band: "strong", verdicts: v("MMMXMM", "XMMP") },
  "sara-mendes": { band: "strong", verdicts: v("MPPMMM", "MMXX") },
  "vasco-santos": { band: "strong", verdicts: v("MMMPPM", "XXPM") },
  "catarina-ribeiro": { band: "strong", verdicts: v("MMMXPM", "XPXP") },
  "miguel-costa": { band: "consider", verdicts: v("MPMXPM", "XXXP") },
  "ana-sofia-pinto": { band: "strong", verdicts: v("MMMPXM", "MMXX") },
  "filipe-rocha": { band: "top", verdicts: v("MMMMMM", "MXPM") },
  "laura-fernandez": { band: "top", verdicts: v("MMMPMM", "MXMX") },
  "gabriel-souza": { band: "disqualified", verdicts: null },
  "joana-teixeira": { band: "not_recommended", verdicts: v("PXPXPM", "XXXX") },
};

/** Band thresholds used for the pass check. */
export function bandOf(score: number): CohortTarget["band"] {
  if (score >= 95) return "exceptional";
  if (score >= 85) return "top";
  if (score >= 70) return "strong";
  if (score >= 50) return "consider";
  return "not_recommended";
}
