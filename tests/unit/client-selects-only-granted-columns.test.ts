/**
 * A client-scoped read may only ask for columns the client role can select.
 *
 * candidate_matches has a column-level SELECT grant: `authenticated` may read a
 * named list, and five internal columns are withheld. Asking for a withheld
 * column does not return null for that field — Postgres refuses the ENTIRE
 * statement with "permission denied for table candidate_matches".
 *
 * CLIENT_CANDIDATE_SELECT asked for `contact_release_reason`, which is
 * withheld. That single word took out the client's candidate list, board, all
 * stage counts and every candidate detail page simultaneously (audit #8,
 * 3 Sep). Nothing consumed the value; it was selected and thrown away.
 *
 * Two things made it invisible until a real client login hit it:
 *
 *   The denial arrives wrapped in an HTTP 200 with the error inside the body,
 *   so status-code monitoring and the browser console both stay clean.
 *
 *   A table-level `GRANT SELECT` had masked it for weeks. When the column list
 *   was restored, the breakage came back with it — and the migration comment
 *   asserting the withheld columns were "only ever read through supabaseAdmin"
 *   was, by then, no longer true. Prose does not hold; this does.
 *
 * The check parses the granted list out of the migration and the requested
 * columns out of the select, so it stays correct when either changes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_CANDIDATE_SELECT } from "@/lib/client-kpi.server";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** Columns granted for SELECT to `authenticated`, per the newest grant. */
function grantedColumns(): string[] {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), "utf8");
    const m = sql.match(
      /GRANT SELECT \(([\s\S]*?)\)\s*ON public\.candidate_matches TO authenticated/,
    );
    if (m) {
      return m[1]
        .split(",")
        .map((s) => s.replace(/--.*$/gm, "").trim())
        .filter(Boolean);
    }
  }
  return [];
}

/**
 * Top-level columns requested from candidate_matches itself — embedded tables
 * like `positions(...)` are governed by their own grants, so their inner
 * columns are skipped.
 */
function requestedColumns(select: string): string[] {
  let depth = 0;
  let current = "";
  const out: string[] = [];
  for (const ch of select) {
    if (ch === "(") {
      depth += 1;
      current += ch; // keep it, so embeds are recognisable and filtered below
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      continue;
    }
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    if (depth === 0) current += ch;
  }
  out.push(current);
  return out
    .map((s) => s.trim())
    .filter(Boolean)
    // Drop embeds (`positions(...)`) and aliases (`score_runs:approved_...`).
    .filter((s) => !s.includes("(") && !s.includes(":"))
    .map((s) => s.split(/\s+/)[0]);
}

describe("the client candidate select stays inside its grant", () => {
  const granted = new Set(grantedColumns());

  it("the migration actually defines a column-level grant", () => {
    // If this ever finds nothing, every assertion below would pass vacuously.
    expect(granted.size, "no GRANT SELECT column list found in any migration").toBeGreaterThan(10);
  });

  it("every requested column is granted", () => {
    const requested = requestedColumns(CLIENT_CANDIDATE_SELECT);
    expect(requested.length, "parsed no columns out of the select").toBeGreaterThan(5);

    const denied = requested.filter((c) => !granted.has(c));
    expect(
      denied,
      "Postgres refuses the WHOLE statement for these, not just the column — " +
        "the client's candidate list, board, counts and detail pages all fail at once:\n" +
        denied.join(", "),
    ).toEqual([]);
  });

  it("does not ask for the internal columns that are withheld on purpose", () => {
    for (const col of [
      "contact_release_reason",
      "recommendation_reason",
      "processing_error_code",
      "processing_error_message",
      "last_processing_trace_id",
    ]) {
      expect(
        CLIENT_CANDIDATE_SELECT,
        `${col} is withheld from the client role; selecting it denies the whole read`,
      ).not.toMatch(new RegExp(`\\b${col}\\b`));
    }
  });
});
