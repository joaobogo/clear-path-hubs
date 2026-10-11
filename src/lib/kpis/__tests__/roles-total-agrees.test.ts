/**
 * One account, one total.
 *
 * `countRolesForOrg` (client Account overview) and `org-rollups` (admin
 * accounts list) both report a role total. The rollup counted drafts and
 * archived roles; this reader dropped them before counting, so an account with
 * one draft read "1 role" in one place and "0" in the other. The database
 * parity gate (tests/kpis/kpi-sync.test.ts) caught it on a live workspace.
 * These tests hold the rule without a database.
 */
import { describe, expect, it } from "vitest";
import { countRolesForOrg, countOpenRolesForOrg } from "@/lib/kpis/open-roles.server";
import { countClientRoles } from "@/lib/client/role-counts";

const ORG = "00000000-0000-0000-0000-0000000000aa";

const ROLES = [
  {
    id: "r1",
    title: "Registered nurse",
    status: "active",
    is_test_record: false,
    organization_id: ORG,
  },
  { id: "r2", title: "Line cook", status: "paused", is_test_record: false, organization_id: ORG },
  {
    id: "r3",
    title: "Front office manager",
    status: "draft",
    is_test_record: false,
    organization_id: ORG,
  },
  {
    id: "r4",
    title: "Warehouse supervisor",
    status: "archived",
    is_test_record: false,
    organization_id: ORG,
  },
  { id: "r5", title: "Porter", status: "closed", is_test_record: false, organization_id: ORG },
  {
    id: "r6",
    title: "QA-run fixture",
    status: "active",
    is_test_record: false,
    organization_id: ORG,
  },
  { id: "r7", title: "Chef", status: "active", is_test_record: true, organization_id: ORG },
];

/** A read-only client: no membership, no staff, positions filtered by org. */
function fakeClient(rows: typeof ROLES) {
  return {
    from(table: string) {
      return {
        select() {
          const wheres: Array<[string, unknown]> = [];
          const builder = {
            eq(col: string, value: unknown) {
              wheres.push([col, value]);
              return builder;
            },
            limit() {
              return builder;
            },
            then(resolve: (v: { data: unknown[]; error: null }) => unknown) {
              const source = table === "positions" ? rows : [];
              const data = source.filter((r) =>
                wheres.every(([c, v]) => (r as Record<string, unknown>)[c] === v),
              );
              return Promise.resolve({ data, error: null }).then(resolve);
            },
          };
          return builder;
        },
      };
    },
  };
}

describe("role totals agree across readers", () => {
  it("counts drafts and archived roles in the total, never test records", async () => {
    const counts = await countRolesForOrg(fakeClient(ROLES), ORG);
    expect(counts).toEqual({ open: 2, total: 5 });
  });

  it("matches the admin rollup's rule on the same rows", async () => {
    const counts = await countRolesForOrg(fakeClient(ROLES), ORG);
    expect(counts).toEqual(countClientRoles(ROLES));
  });

  it("leaves the open count unchanged", async () => {
    expect(await countOpenRolesForOrg(fakeClient(ROLES), ORG)).toBe(2);
  });

  it("an account whose only role is a draft has a total of one and nothing open", async () => {
    const counts = await countRolesForOrg(fakeClient([ROLES[2]!]), ORG);
    expect(counts).toEqual({ open: 0, total: 1 });
  });
});
