import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "drizzle/migrations/0001_restrict_tracking_policy_public_reads.sql",
  "utf8",
).replace(/--[^\n]*/g, "");
const reader = readFileSync("src/lib/tracking/policy.functions.ts", "utf8");

describe("tracking policy public access", () => {
  it("restricts public reads to the singleton and excludes staff attribution", () => {
    expect(migration).toMatch(/REVOKE SELECT ON public\.tracking_policy FROM anon, authenticated/);
    expect(migration).toMatch(/USING \(id = true\)/);
    const columns = migration.match(/GRANT SELECT \(([^)]+)\)/)?.[1];
    expect(columns).toBe("id, essential_trackers, require_prior_opt_in_everywhere, updated_at");
    expect(columns).not.toContain("updated_by");
    expect(migration).not.toMatch(/USING \(true\)/);
  });

  it("preserves the public reader's projection and staff write authorization", () => {
    expect(reader).toContain('.select("essential_trackers, require_prior_opt_in_everywhere, updated_at")');
    expect(reader).toContain('.eq("id", true)');
    expect(reader).toContain('.rpc("is_platform_staff", { _user: userId })');
    expect(migration).not.toMatch(/REVOKE UPDATE|ALTER POLICY "platform staff/);
  });
});