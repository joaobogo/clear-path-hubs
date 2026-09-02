/**
 * Editing your own row does not mean editing every column of it.
 *
 * Three tables let a non-staff caller UPDATE their own row under a policy that
 * checks WHICH ROW and never WHICH COLUMNS, over a table-wide GRANT UPDATE to
 * `authenticated`. RLS has nothing to say about columns; that is what column
 * grants are for, and they were missing.
 *
 *   F45  profiles — `is_active_user()` is defined as
 *        `EXISTS (SELECT 1 FROM profiles WHERE auth_user_id = _user AND
 *        status = 'active')` and gates much of the policy surface, while
 *        profiles_self is FOR ALL on your own row. A user whose access had been
 *        withdrawn could set their own status back to 'active'. The
 *        profile_status_reassignment trigger is AFTER UPDATE OF status and
 *        reacts rather than blocks — it would clear the reassignment flags for
 *        them.
 *
 *   F46  organizations — a workspace admin could write client_seat_limit,
 *        plan_name, the billing window, the pilot lifecycle, and the
 *        is_demo/is_internal/is_qa/is_test_record reporting flags.
 *
 *   F47  candidate_profiles — narrowed to what the self-service editor writes.
 *        `email` is withheld because the public apply handler resolves an auth
 *        account by it when linking an unclaimed candidate profile.
 *
 * The last test is the load-bearing one: it holds the assumption the grants
 * rest on, by scanning what the application actually writes. Widen a patch
 * without widening the grant and it fails here rather than in production.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { userScopedWrites } from "@tests/helpers/user-scoped-writes";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const migrations = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ name: f, sql: readFileSync(join(MIGRATIONS, f), "utf8") }));

const fix = migrations.find((m) => m.name.includes("self_write_column_privileges"))!;

/** Columns granted for UPDATE to `authenticated` on `table`, per the fix. */
function grantedColumns(table: string): string[] {
  const m = fix.sql.match(
    new RegExp(`GRANT UPDATE \\(([^)]*)\\)\\s*ON public\\.${table} TO authenticated`, "s"),
  );
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.replace(/--.*$/gm, "").trim())
    .filter(Boolean);
}

const TABLES = ["profiles", "organizations", "candidate_profiles"] as const;

describe("the self-write grants exist and are column-scoped", () => {
  it("ships the migration", () => {
    expect(fix, "the fix migration is missing").toBeDefined();
  });

  it.each(TABLES)("%s revokes the blanket UPDATE and grants a column list", (table) => {
    expect(fix.sql).toMatch(
      new RegExp(`REVOKE UPDATE[^;]*ON public\\.${table} FROM authenticated;`),
    );
    expect(grantedColumns(table).length, `${table} has no column grant`).toBeGreaterThan(0);
  });

  it("is the last word on these privileges", () => {
    // 20260817181351 undid 20260810170529 exactly this way: a later table-level
    // grant reopens everything, and nothing fails at the time.
    const after = migrations.slice(migrations.findIndex((m) => m.name === fix.name) + 1);
    for (const m of after) {
      for (const table of TABLES) {
        expect(
          m.sql,
          `${m.name} re-grants table-level UPDATE on ${table}, undoing the column grant`,
        ).not.toMatch(
          new RegExp(`GRANT\\s+(?:ALL|[A-Z, ]*UPDATE[A-Z, ]*)\\s+ON public\\.${table} TO authenticated`),
        );
      }
    }
  });
});

describe("the columns that must stay out of reach", () => {
  it("profiles.status is not self-writable — it gates is_active_user", () => {
    expect(
      grantedColumns("profiles"),
      "granting status lets a suspended user reactivate themselves",
    ).not.toContain("status");
  });

  it("neither profiles.email nor candidate_profiles.email is self-writable", () => {
    // The public apply handler links an unclaimed candidate profile to the auth
    // account it finds by email. A writable email turns that into a takeover.
    expect(grantedColumns("profiles")).not.toContain("email");
    expect(grantedColumns("candidate_profiles")).not.toContain("email");
  });

  it("a workspace admin cannot write their own commercial terms", () => {
    const granted = grantedColumns("organizations");
    for (const col of [
      "plan_name",
      "client_seat_limit",
      "billing_interval",
      "billing_period_end",
      "renewal_date",
      "pilot_status",
      "pilot_ends_at",
      "pilot_used",
      "pilot_admin_override",
      "status",
      "parent_organization_id",
      "internal_notes",
    ]) {
      expect(granted, `organizations.${col} must not be self-writable`).not.toContain(col);
    }
  });

  it("reporting-scope flags are not self-writable on any of them", () => {
    // A row that can flag itself as a test record can hide from staff reporting.
    for (const table of TABLES) {
      for (const col of ["is_test_record", "test_run_id", "expires_at"]) {
        expect(grantedColumns(table), `${table}.${col}`).not.toContain(col);
      }
    }
  });
});

describe("the assumption the grants rest on", () => {
  it.each(TABLES)("no user-scoped write to %s exceeds its grant", (table) => {
    const granted = new Set(grantedColumns(table));
    const offenders: string[] = [];

    for (const w of userScopedWrites(table)) {
      if (w.unresolved) {
        offenders.push(
          `${w.file}:${w.line} patch could not be resolved — check it by hand and inline the literal`,
        );
        continue;
      }
      const over = w.columns.filter((c) => !granted.has(c));
      if (over.length > 0) {
        offenders.push(`${w.file}:${w.line} (${w.receiver}) writes ${over.join(", ")}`);
      }
    }

    expect(
      offenders,
      `these writes travel on the user's JWT and will be refused by the column grant on ${table}. ` +
        "Widen the grant deliberately, or route the write through the server client:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
