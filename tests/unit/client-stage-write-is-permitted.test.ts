/**
 * The grant and the trigger must agree about `stage`.
 *
 * Two fixes for the same finding landed independently and contradicted each
 * other on exactly one column. A trigger
 * (guard_candidate_matches_client_columns) raised "This change needs admin
 * review" whenever a non-staff caller changed `stage`; a column grant on the
 * same table gave `authenticated` `UPDATE (stage)` and nothing else.
 *
 * Both cannot hold. `stage` is the product's core client action — Shortlist,
 * Reopen, Make offer, Mark hired and the kanban all move it from the client
 * workspace — so the trigger as written broke every one of those buttons for
 * every client, while the grant existed specifically to allow them.
 *
 * The decision is that clients keep stage changes. This test holds both halves
 * of that so the next person to edit either mechanism cannot reintroduce the
 * contradiction silently — which is how it arrived, since each fix was correct
 * on its own and neither author could see the other's.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ name: f, sql: readFileSync(join(MIGRATIONS, f), "utf8") }));

/** The last definition of the guard wins — that is the live behaviour. */
const lastGuard = [...migrations]
  .reverse()
  .find((m) => m.sql.includes("FUNCTION public.guard_candidate_matches_client_columns"));

/** The last UPDATE grant on candidate_matches wins. */
const lastGrant = [...migrations]
  .reverse()
  .find((m) => /GRANT UPDATE \([^)]*\) ON public\.candidate_matches TO authenticated/.test(m.sql));

describe("stage is writable by a client", () => {
  it("the trigger no longer forbids it", () => {
    expect(lastGuard, "the column guard is missing entirely").toBeDefined();
    expect(
      lastGuard!.sql,
      "forbidding stage here breaks Shortlist, Reopen, Make offer, Mark hired and the kanban " +
        "for every client, and contradicts the column grant",
    ).not.toMatch(/NEW\.stage IS DISTINCT FROM OLD\.stage/);
  });

  it("the grant still permits it", () => {
    expect(lastGrant, "the column grant is missing entirely").toBeDefined();
    expect(lastGrant!.sql).toMatch(/GRANT UPDATE \(\s*stage\s*\) ON public\.candidate_matches/);
  });
});

describe("everything else still needs admin review", () => {
  it("the privileged columns remain in the trigger", () => {
    // Removing stage must not become removing the guard.
    for (const col of [
      "admin_status",
      "canonical_state",
      "client_visibility",
      "recommendation",
      "eligibility_status",
      "contact_released_at",
      "contact_release_reason",
      "organization_id",
      "position_id",
      "candidate_profile_id",
      "approved_score_run_id",
      "current_score_run_id",
    ]) {
      expect(
        lastGuard!.sql,
        `${col} must still raise for a non-staff caller`,
      ).toMatch(new RegExp(`NEW\\.${col} IS DISTINCT FROM OLD\\.${col}`));
    }
  });

  it("still raises rather than silently dropping the write", () => {
    expect(lastGuard!.sql).toMatch(/RAISE EXCEPTION/);
    expect(lastGuard!.sql).toMatch(/needs admin review/);
  });

  it("staff and service role stay unrestricted", () => {
    expect(lastGuard!.sql).toMatch(/IF auth\.uid\(\) IS NULL THEN\s*RETURN NEW;/);
    expect(lastGuard!.sql).toMatch(/IF is_staff THEN\s*RETURN NEW;/);
  });
});

describe("a refused stage write cannot be reported as success", () => {
  it("every stage write selects the row back", () => {
    // The trigger now raises, which surfaces. But RLS filtering a row out does
    // not raise — it updates zero rows with error: null. persistStage is what
    // catches that, and it is why removing stage from the trigger is safe.
    const helper = readFileSync(
      join(process.cwd(), "src", "lib", "client", "persist-stage.ts"),
      "utf8",
    );
    expect(helper).toMatch(/\.select\("id, stage"\)/);
    expect(helper).toMatch(/if \(!data\) throw new StageNotPersistedError/);
  });
});
