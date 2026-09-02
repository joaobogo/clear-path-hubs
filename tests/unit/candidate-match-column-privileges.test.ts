/**
 * A client editor may write `stage` on a candidate match, and nothing else.
 *
 * RLS is ROW-level. `cm_client_editor_update` decided WHICH ROWS a client editor
 * could write; it never had anything to say about WHICH COLUMNS. The original
 * schema granted `SELECT, INSERT, UPDATE, DELETE` on candidate_matches to
 * `authenticated` and nothing narrowed it, so a client holding `add_feedback`
 * could write any column on a published, visible match — including
 * canonical_state, which its own USING clause required but its WITH CHECK
 * omitted. That is admin review, bypassed (audit 1 Sep, F43).
 *
 * The guard trigger did not cover this: candidate_matches_stage_guard is
 * declared `BEFORE UPDATE OF stage` and validates stage transitions only.
 *
 * Separately, 20260810170529 withheld five internal columns behind a
 * column-level SELECT grant, and 20260817181351 undid it seven days later with a
 * table-level `GRANT SELECT`. Nothing failed, so nothing surfaced it
 * (audit 1 Sep, F44).
 *
 * These tests read the migration and the application source. They cannot execute
 * SQL, so what they hold is the shape of the fix and — more usefully — the
 * assumption the fix rests on: that no user-scoped code writes any column but
 * `stage`. The day someone adds such a write, that write will fail against the
 * grant in production. This fails first, and says so.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { userScopedWrites } from "@tests/helpers/user-scoped-writes";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** Every migration, newest last — privileges are last-writer-wins. */
const migrations = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ name: f, sql: readFileSync(join(MIGRATIONS, f), "utf8") }));

const fix = migrations.find((m) => m.name.includes("candidate_matches_column_privileges"));

describe("candidate_matches write privileges", () => {
  it("ships the migration that narrows them", () => {
    expect(fix, "the fix migration is missing").toBeDefined();
  });

  it("revokes the blanket UPDATE and grants only stage", () => {
    expect(fix!.sql).toMatch(
      /REVOKE UPDATE[^;]*ON public\.candidate_matches FROM authenticated;/,
    );
    expect(fix!.sql).toMatch(
      /GRANT UPDATE \(stage\) ON public\.candidate_matches TO authenticated;/,
    );
  });

  it("pins canonical_state in WITH CHECK, not only in USING", () => {
    // The finding: USING constrained the OLD row, WITH CHECK left the NEW row
    // free, so the column could be written to anything.
    const policy = fix!.sql.slice(fix!.sql.indexOf("CREATE POLICY cm_client_editor_update"));
    const withCheck = policy.slice(policy.indexOf("WITH CHECK"));
    expect(
      withCheck,
      "WITH CHECK must re-assert canonical_state or the new row is unconstrained",
    ).toMatch(/canonical_state = 'published_to_client'/);
  });

  it("is the last word on those privileges", () => {
    // 20260817181351 undid 20260810170529 exactly this way. A later broad grant
    // silently reopens everything, and nothing fails at the time.
    const after = migrations.slice(migrations.findIndex((m) => m.name === fix!.name) + 1);
    for (const m of after) {
      expect(
        m.sql,
        `${m.name} re-grants table-level privileges on candidate_matches, undoing the column grant`,
      ).not.toMatch(
        /GRANT\s+(ALL|SELECT|UPDATE|INSERT|DELETE)[A-Z,\s]*ON public\.candidate_matches TO authenticated/,
      );
    }
  });
});

describe("candidate_matches read privileges", () => {
  it("withholds the five internal columns again", () => {
    for (const col of [
      "recommendation_reason",
      "contact_release_reason",
      "processing_error_code",
      "processing_error_message",
      "last_processing_trace_id",
    ]) {
      const granted = new RegExp(`GRANT SELECT \\([^)]*\\b${col}\\b`, "s");
      expect(fix!.sql, `${col} must not be readable by authenticated`).not.toMatch(granted);
    }
  });

  it("keeps granting the columns that were added after the original list", () => {
    // Re-applying 20260810170529's list verbatim would have revoked these,
    // because they did not exist when it was written.
    for (const col of ["intro_video_url", "intro_video_added_at", "intro_video_added_by"]) {
      expect(fix!.sql, `${col} exists today and would break if dropped from the list`).toMatch(
        new RegExp(`\\b${col}\\b`),
      );
    }
  });
});

describe("the assumption the grant rests on", () => {
  it("no user-scoped path writes any column but stage", () => {
    // Staff writes go through the service_role client and are unaffected by
    // grants to `authenticated`. User-scoped writes will now be REFUSED for any
    // column but stage — so a new one has to be caught here, not in production.
    //
    // The scan lives in a helper because getting it right took three attempts:
    // a line-by-line scan matched nothing (the call spans newlines) and passed
    // vacuously; exempting on the receiver NAME marked a real user-scoped write
    // safe; and a literal-only patch reader cannot see `.update(patch)`.
    const offenders = userScopedWrites("candidate_matches")
      .map((w) => {
        if (w.unresolved) return `${w.file}:${w.line} patch could not be resolved`;
        const over = w.columns.filter((c) => c !== "stage");
        return over.length > 0 ? `${w.file}:${w.line} (${w.receiver}) writes ${over.join(", ")}` : null;
      })
      .filter((x): x is string => x !== null);

    expect(
      offenders,
      "these writes will be refused by the column grant — widen the grant deliberately " +
        "or route through the server client:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
