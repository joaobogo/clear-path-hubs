/**
 * Pins migration 0011 (v_admin_candidate_index.published_score / published_band)
 * to the app-side fold in published-score.ts.
 *
 * The admin list filters and sorts in Postgres on these two columns while it
 * displays the figure withVideoIntroBonus folds at read time. If the SQL
 * headroom and videoBonusFor ever drift apart, a candidate would be filtered
 * under one band and shown under another, which is the defect 0011 fixes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { classifyBand } from "../bands";
import {
  SCORE_MAX,
  VIDEO_INTRO_BONUS_PTS,
  hasVideoIntro,
  publishedBand,
  publishedScore,
  videoBonusFor,
  withVideoIntroBonus,
} from "../published-score";

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), "utf8").replace(/\r\n/g, "\n");
const sql0011 = read("drizzle/migrations/0011_admin_index_published_score.sql");
const sql0004 = read("drizzle/migrations/0004_resolve_admin_candidate_override_rankings.sql");

/** The select list of a CREATE OR REPLACE VIEW, split on top-level commas. */
function selectItems(sql: string): string[] {
  const body = sql.split("CREATE OR REPLACE VIEW public.v_admin_candidate_index AS\n")[1]!;
  const list = body.slice(
    body.indexOf("SELECT ") + "SELECT ".length,
    body.indexOf("\nFROM public.candidate_matches m"),
  );
  const items: string[] = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (const ch of list) {
    if (ch === "'") quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === ",") {
      items.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  items.push(cur.trim());
  return items;
}

function columnName(item: string): string {
  const alias = /\sAS\s+([a-z_]+)$/i.exec(item);
  return alias ? alias[1]! : item.slice(item.lastIndexOf(".") + 1);
}

const items0004 = selectItems(sql0004);
const items0011 = selectItems(sql0011);
const item = (name: string) => items0011.find((i) => columnName(i) === name)!;

const VOID =
  "m.processing_state::text='ocr_required' OR m.processing_error_code IN ('cv_employment_history_missing','cv_missing','cv_file_missing','cv_unparsed')";
const BASE = "COALESCE(ov.approved_score,sr.final_score,sr.score)";

/** Every `GREATEST(0, LEAST(cap, max - base))` the migration writes. */
const headrooms = [
  ...sql0011.matchAll(
    /GREATEST\(0, LEAST\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?) - (COALESCE\([^)]*\))\)\)/g,
  ),
].map((m) => ({ cap: Number(m[1]), max: Number(m[2]), base: m[3] }));

/** The SQL published_score, evaluated with the constants parsed from the migration. */
function sqlPublishedScore(base: number | null, intro: string | null): number | null {
  if (base === null) return null; // NULL + anything is NULL
  const { cap, max } = headrooms[0]!;
  const video = (intro ?? "").trim() !== "";
  const v = base + (video ? Math.max(0, Math.min(cap, max - base)) : 0);
  return Math.round(v * 100) / 100; // ::numeric(6,2)
}

describe("migration 0011: v_admin_candidate_index published columns", () => {
  it("keeps every existing column, unchanged and in order, and appends the two new ones", () => {
    expect(items0004).toHaveLength(54);
    expect(items0011.slice(0, items0004.length)).toEqual(items0004);
    expect(items0011.slice(items0004.length).map(columnName)).toEqual([
      "published_score",
      "published_band",
    ]);
  });

  it("writes the headroom with the constants videoBonusFor uses", () => {
    // Once in published_score, once inside published_band.
    expect(headrooms).toHaveLength(2);
    for (const h of headrooms) {
      expect(h.cap).toBe(VIDEO_INTRO_BONUS_PTS);
      expect(h.max).toBe(SCORE_MAX);
      expect(h.base).toBe(BASE);
    }
  });

  it("SQL headroom equals videoBonusFor on every base from 0 to 100", () => {
    const { cap, max } = headrooms[0]!;
    for (let b = 0; b <= 100; b += 0.25) {
      expect(Math.max(0, Math.min(cap, max - b))).toBe(videoBonusFor(b));
    }
  });

  it("published_score adds the bonus only for a non-blank intro video and keeps the unreadable-CV void", () => {
    const pub = item("published_score");
    expect(
      pub.startsWith(
        `(CASE WHEN ${VOID} THEN NULL ELSE ${BASE} + CASE WHEN btrim(COALESCE(m.intro_video_url,''))<>'' THEN`,
      ),
    ).toBe(true);
    expect(pub.endsWith(" ELSE 0 END END)::numeric(6,2) AS published_score")).toBe(true);
    // The void is the one score / final_score / score_band already use.
    expect(item("score")).toContain(VOID);
    expect(item("score_band")).toContain(`ELSE ${BASE} END`);
  });

  it("published_band is public.score_band applied to the published_score expression", () => {
    const expr = item("published_score").replace(/ AS published_score$/, "");
    expect(item("published_band")).toBe(`public.score_band(${expr})::text AS published_band`);
  });

  it("matches the app-side fold for each case, Adiya included", () => {
    const cases: Array<[number | null, string | null]> = [
      [67.5, "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view"],
      [67.5, null],
      [67.5, "   "],
      [97, "https://www.loom.com/share/0123456789abcdef0123"],
      [95, "https://www.loom.com/share/0123456789abcdef0123"],
      [100, "https://www.loom.com/share/0123456789abcdef0123"],
      [66, "https://www.loom.com/share/0123456789abcdef0123"],
      [0, "https://www.loom.com/share/0123456789abcdef0123"],
      [null, "https://www.loom.com/share/0123456789abcdef0123"],
    ];
    for (const [base, intro] of cases) {
      const row = { score: base, final_score: base };
      const folded = withVideoIntroBonus(row, hasVideoIntro({ intro_video_url: intro }));
      const sql = sqlPublishedScore(base, intro);
      expect(sql).toBe(publishedScore(folded));
      // score_band(NULL) is 'unscored'; publishedBand(null) is null and the
      // list renders it as "unscored".
      expect(classifyBand(sql)).toBe(publishedBand(folded) ?? "unscored");
    }
    expect(sqlPublishedScore(67.5, "https://drive.google.com/file/d/x/view")).toBe(72.5);
    expect(classifyBand(sqlPublishedScore(67.5, "https://drive.google.com/file/d/x/view"))).toBe(
      "strong",
    );
    expect(sqlPublishedScore(97, "https://www.loom.com/share/x")).toBe(100);
  });

  it("is registered in the drizzle journal after 0010 with a chained snapshot", () => {
    const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json")) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    const last = journal.entries[journal.entries.length - 1]!;
    expect(last).toMatchObject({
      idx: 11,
      tag: "0011_admin_index_published_score",
      when: 1793577600000,
    });
    const s10 = JSON.parse(read("drizzle/migrations/meta/0010_snapshot.json")) as { id: string };
    const s11 = JSON.parse(read("drizzle/migrations/meta/0011_snapshot.json")) as {
      id: string;
      prevId: string;
    };
    expect(s11.prevId).toBe(s10.id);
    expect(s11.id).not.toBe(s10.id);
  });
});
