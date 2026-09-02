/**
 * One workspace, one answer to "what plan is this?".
 *
 * The client Account page told a client "No plan on record yet · Your team will
 * confirm your commercial setup" while the admin Access tab for the SAME
 * organisation read "Owner seat plus 3 recruiter seats on Bronze"
 * (launch pass round 3).
 *
 * Two readers. Admin renders planDisplayLabel(accountState.plan), which
 * resolves subscription → entitlement → workspace in priority order. The client
 * panel read getPlanState, whose type carried only `subscription` and
 * `allowance` — so a plan recorded on the workspace itself
 * (organizations.plan_name, which is where Bronze lives when the workspace has
 * no billing subscription at all) was invisible to it.
 *
 * account-state.ts was written to end exactly this: its docstring opens on "a
 * single record then read 'No plan' on Overview, 'current plan' on Access". The
 * client panel had simply never been moved onto it.
 *
 * The conservative rule it was carrying still holds. C-05 was about not
 * inventing "Pay per role" out of nothing; it was never about hiding a plan the
 * business has recorded. When there is genuinely no plan the label is null and
 * the client still sees "No plan on record yet".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planDisplayLabel, NO_PLAN_LABEL } from "@/lib/account-state";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const panel = read("src/components/client/plan-panel.tsx");
const server = read("src/lib/plans.functions.ts");

describe("the client plan panel reads the shared account state", () => {
  it("getPlanState returns the canonical plan", () => {
    expect(
      server,
      "without this the client cannot see a workspace-recorded plan at all",
    ).toMatch(/plan: \(await readAccountState\(/);
  });

  it("the panel falls back to it before claiming there is no plan", () => {
    expect(panel).toMatch(/plan\?\.label \?\? "No plan on record yet"/);
  });

  it("the 'your team will confirm' note is suppressed once a plan is known", () => {
    // Telling a Bronze customer their commercial setup is unconfirmed is the
    // same defect wearing a softer sentence.
    expect(panel).toMatch(/!plan\?\.label && \(|&& !plan\?\.label/);
  });
});

describe("C-05 still holds: no plan is invented", () => {
  it("a workspace with no plan anywhere still reads as having none", () => {
    expect(planDisplayLabel({ label: null, source: "none", status: null })).toBe(NO_PLAN_LABEL);
  });

  it("every real source produces the label the admin surfaces show", () => {
    for (const source of ["subscription", "entitlement", "workspace"] as const) {
      expect(planDisplayLabel({ label: "Bronze", source, status: "active" })).toBe("Bronze");
    }
  });
});
