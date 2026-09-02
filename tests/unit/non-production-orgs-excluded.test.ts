/**
 * "Not a real customer" means the same thing everywhere.
 *
 * Three non-production flags exist on `organizations`: is_test_record, is_demo
 * and is_qa. qa-guard's `isQaSafeOrg` treats any of the three as
 * non-production, and notification-email.server and notifications.functions
 * both check all three before treating a workspace as real.
 *
 * `loadTestScope` — the filter every staff rollup goes through — read only
 * is_test_record. So the demo workspace shown to prospects, which is flagged
 * is_demo (the seeder refuses to run without it) and deliberately NOT
 * is_test_record, counted as a real customer in every admin figure: 14 of 24
 * published candidates, 5 of 15 overdue client decisions, 3 of 3 interviews to
 * coordinate, and the only hire, salary and start date on the Offers desk
 * (launch pass round 5).
 *
 * Excluding it here does not empty the demo for a prospect. Client-facing
 * loaders filter on the ROW-level is_test_record, which the seeder sets false
 * on every demo record and asserts. Two flags, two audiences — this test holds
 * both halves, because fixing the admin half by flagging the rows would break
 * the demo.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isQaSafeOrg } from "@/lib/qa-guard";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const scope = read("src/lib/admin-test-scope.server.ts");

describe("the staff scope filter matches the non-production predicate", () => {
  it("excludes an org flagged by any of the three flags", () => {
    for (const flag of ["is_test_record", "is_demo", "is_qa"] as const) {
      expect(
        scope,
        `${flag} marks a workspace non-production but the scope filter ignores it`,
      ).toMatch(new RegExp(`${flag}\\.eq\\.true`));
    }
  });

  it("does not filter on a single flag", () => {
    // The finding's exact shape: .eq("is_test_record", true) and nothing else.
    expect(scope).not.toMatch(/\.select\("id"\)\s*\.eq\("is_test_record", true\)/);
  });

  it("agrees with isQaSafeOrg, which is the canonical rule", () => {
    expect(isQaSafeOrg({ is_demo: true })).toBe(true);
    expect(isQaSafeOrg({ is_qa: true })).toBe(true);
    expect(isQaSafeOrg({ is_test_record: true })).toBe(true);
    expect(isQaSafeOrg({})).toBe(false);
    expect(isQaSafeOrg({ is_demo: false, is_qa: false, is_test_record: false })).toBe(
      false,
    );
  });
});

describe("the demo stays visible to the prospect it exists for", () => {
  it("the seeder keeps demo RECORDS unflagged, so client reads still show them", () => {
    const seeder = read("scripts/seed-northwind-demo.ts");
    // Flagging the rows would fix the admin rollups and empty the demo.
    expect(seeder).toMatch(/is_test_record: false/);
    expect(seeder).toMatch(/is_test_record false everywhere/);
  });

  it("the seeder requires the org flag this fix now reads", () => {
    const seeder = read("scripts/seed-northwind-demo.ts");
    expect(seeder).toMatch(/is_demo !== true/);
  });
});
