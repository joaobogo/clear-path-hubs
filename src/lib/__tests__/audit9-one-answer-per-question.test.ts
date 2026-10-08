/**
 * Audit #9: one question, one answer.
 *
 * Every finding below was the same defect wearing different clothes — two
 * surfaces computing the same figure from different rules, and disagreeing in
 * front of the client:
 *
 *  - "Shortlisted 6" opening a list of 5, because the tile counted lanes and
 *    the list filtered raw stages.
 *  - "3 hires confirmed" in the prose under a role beside a Hires cell of 1,
 *    because the prose counted the Hired column and the cell counted confirmed
 *    offer records.
 *  - "3 waiting on you · Confirm time" over three interviews the interviews
 *    page itself labelled "Waiting on TaaSFlow".
 *  - "Based on 1 of 0 open offers".
 *  - A banner reading "0 organisations excluded" while an organisation was
 *    being excluded.
 *
 * These are source-reading assertions on purpose. Each one names the rule that
 * has to stay shared; a future edit that re-forks the derivation fails here
 * rather than in front of a client.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { laneFor } from "@/lib/client-pipeline-lane";
import {
  matchesInterviewTile,
  reviewGroup,
} from "@/lib/client-candidate-list-filter";
import type { ClientCandidateDTO } from "@/lib/client-kpi.server";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const dto = (over: Record<string, unknown>) =>
  ({
    match_id: "m",
    stage: "delivered",
    interview_active: false,
    interview_called_off: false,
    ...over,
  }) as unknown as ClientCandidateDTO;

describe("the candidate list answers with the same rule the tiles counted", () => {
  it("filters by lane, not by raw stage", () => {
    const code = strip(src("src/lib/client-candidate-list-filter.ts"));
    expect(code, "the list must import the canonical lane rule").toMatch(/laneFor/);
    expect(
      code,
      "a raw-stage comparison in the stage filter is the defect itself",
    ).not.toMatch(/c\.stage !== s\.stage/);
  });

  it("keeps the manually tracked interview stage on every surface", () => {
    const calledOff = dto({
      stage: "interview_process",
      interview_called_off: true,
      interview_active: false,
    });
    expect(laneFor(calledOff)).toBe("interview_process");
    expect(matchesInterviewTile(calledOff)).toBe(true);
    expect(reviewGroup(calledOff)).toBe("in_progress");
  });

  it("does not fold the offer lane into the interview drill-through", () => {
    expect(matchesInterviewTile(dto({ stage: "offer" }))).toBe(false);
    expect(matchesInterviewTile(dto({ stage: "interview_process" }))).toBe(true);
  });
});

describe("a hire means one thing", () => {
  it("the roles prose counts confirmed hires, like the cell beside it", () => {
    const code = strip(src("src/lib/client-shared.server.ts"));
    const fn = code.slice(code.indexOf("export function pipelineLanguageInput"));
    const body = fn.slice(0, fn.indexOf("export function nextMilestoneFor"));
    expect(body, "prose and cell must share the confirmed-hire selector").toMatch(
      /hires:\s*rows\.filter\(\(r\) => r\.hire_confirmed\)\.length/,
    );
    expect(body, "counting the Hired lane is what disagreed with the cell").not.toMatch(
      /hires:\s*counts\.hired/,
    );
  });
});

describe("an interview nobody sent times for is not the client's move", () => {
  it("the shared reader can compute the holder", () => {
    const code = strip(src("src/lib/kpis/interviews.server.ts"));
    expect(code, "availability_expires_at is required by interviewHolder").toMatch(
      /availability_expires_at/,
    );
    expect(code).toMatch(/export function awaitingClient/);
  });

  it("every client-facing surface narrows to what the client owns", () => {
    for (const file of [
      "src/lib/client/open-items.server.ts",
      "src/lib/client-overview.functions.ts",
      "src/lib/client-positions.functions.ts",
      "src/lib/executive.functions.ts",
    ]) {
      expect(strip(src(file)), `${file} reports pending interviews unfiltered`).toMatch(
        /awaitingClient|ownedByClient/,
      );
    }
  });

  it("the count behind 'waiting on you' is the client-owned one", () => {
    const code = strip(src("src/lib/kpis/interviews.server.ts"));
    const fn = code.slice(code.indexOf("export async function countInterviewsAwaitingTime"));
    expect(fn).toMatch(/awaitingClient\(/);
  });
});

describe("figures that are subsets say so", () => {
  it("open offers with compensation can never exceed open offers", () => {
    const code = strip(src("src/lib/executive.functions.ts"));
    expect(code, '"1 of 0" came from two different populations').toMatch(
      /Math\.min\(compRows\.length, openOfferCount\)/,
    );
  });
});

describe("the hidden-scope banner reports the set that is hidden", () => {
  it("counts through the same helper that does the excluding", () => {
    const code = strip(src("src/lib/test-scope.functions.ts"));
    const fn = code.slice(code.indexOf("async function countExcluded"));
    const body = fn.slice(0, fn.indexOf("export const getTestScopeState"));
    expect(body, "must delegate rather than re-query one flag").toMatch(/loadTestScope/);
    expect(
      body,
      "counting is_test_record alone missed the demo org, which is flagged is_demo",
    ).not.toMatch(/is_test_record/);
  });

  it("the publish desk scopes out non-production organisations", () => {
    const code = strip(src("src/lib/admin.functions.ts"));
    const fn = code.slice(code.indexOf("export const getPublishDeskGroups"));
    const body = fn.slice(0, 4000);
    expect(body, "the publish desk counted the demo workspace as a customer").toMatch(
      /excludeTestOrgs/,
    );
  });
});

describe("promises match the engine", () => {
  it("the apply form does not promise more video points than the engine awards", () => {
    const apply = src("src/routes/jobs.$id.apply.tsx");
    expect(apply, "the number must come from the constant").toMatch(/VIDEO_INTRO_BONUS_PTS/);
    expect(apply).not.toMatch(/adds 10 points/);
  });

  it("historical offer currency survives after off-platform offer management", () => {
    const hires = strip(src("src/lib/hires.functions.ts"));
    expect(hires).toMatch(/salary_currency: string \| null/);
    expect(hires, "the column has to be selected to be reported").toMatch(
      /salary_amount, salary_currency/,
    );
    const clientOfferRoute = strip(src("src/routes/_authenticated/client.offers.tsx"));
    expect(clientOfferRoute).toContain('to: "/client/candidates"');
    expect(clientOfferRoute).not.toMatch(/formatMoneyMajorCompact|Extend offer|Create offer/);
    // Salary currency still belongs in historical hire records and reporting,
    // but client offers are no longer issued through the dashboard.
  });
});

describe("a client can undo what a client can do", () => {
  it("a kept candidate can be removed from the pool, not only archived", () => {
    expect(strip(src("src/lib/talent-memory.functions.ts"))).toMatch(
      /export const removeSilverMedalist/,
    );
    expect(strip(src("src/components/client/talent-memory/memory-sheet.tsx"))).toMatch(
      /removeSilverMedalist/,
    );
  });

  it("a refusal from the database reads as a sentence, not as a token", () => {
    // A bare "forbidden" toast is indistinguishable from nothing happening.
    const dict = src("src/lib/humanize-codes.ts");
    for (const code of [
      "forbidden",
      "position_not_draft",
      "position_has_candidates",
      "position_not_found",
    ]) {
      const m = new RegExp(`${code}:\\s*"([^"]+)"`).exec(dict);
      expect(m, `${code} has no human wording`).not.toBeNull();
      expect(m![1], `${code} must read as a sentence`).toMatch(/\s/);
    }
  });
});

describe("an invitation that reserves a seat says whether it was sent", () => {
  it("every exit reports delivery", () => {
    const code = strip(src("src/lib/client-team.functions.ts"));
    expect(code).toMatch(/async function deliverTeamInvite/);
    expect(code, "the reactivation path used to return above all email code").toMatch(
      /reactivated: true,\s*\n?\s*emailDelivered/,
    );
    expect(code, "sendTemplateEmail RETURNS { sent: false } instead of throwing").toMatch(
      /res\?\.sent/,
    );
  });

  it("the UI does not claim success the server did not report", () => {
    for (const file of [
      "src/components/client/account/team-tab.tsx",
      "src/components/admin/client-access-panel.tsx",
    ]) {
      expect(strip(src(file)), `${file} toasts unconditionally`).toMatch(
        /emailDelivered === false/,
      );
    }
  });

  it("the delivery log shows the newest events, not the oldest", () => {
    const code = strip(src("src/components/admin/EmailDeliveryPanel.tsx"));
    expect(
      code,
      "slicing an unsorted list made a healthy pipeline look stalled",
    ).toMatch(/\.sort\(/);
  });
});

describe("a remote role can be saved", () => {
  it("no timezone anchor is required to save", () => {
    const code = strip(src("src/lib/requisition-schema.ts"));
    expect(code).not.toMatch(/Fully remote roles need a timezone anchor/);
  });

  it("both timezone fields offer the eight bands", () => {
    const schema = src("src/lib/requisition-schema.ts");
    expect(schema).toMatch(/TIMEZONE_ANCHOR_SUGGESTIONS/);
    const bands = /TIMEZONE_ANCHOR_SUGGESTIONS[\s\S]*?\];/.exec(schema)?.[0] ?? "";
    // Entries only — the type annotation on the declaration also says `value:`.
    expect((bands.match(/\{ value: "/g) ?? []).length, "eight bands").toBe(8);
    const editor = src("src/components/positions/RequisitionEditor.tsx");
    expect((editor.match(/list=\{TIMEZONE_SUGGESTION_LIST_ID\}/g) ?? []).length).toBe(2);
  });
});

describe("evidence is shown once", () => {
  it("the admin panel does not union the two copies of the same list", () => {
    const code = strip(src("src/lib/evidence/completeness.server.ts"));
    const fn = code.slice(code.indexOf("function toAssessments"));
    const body = fn.slice(0, fn.indexOf("export interface CompletenessPayload"));
    expect(body, "result.evidence is the flattened union of the assessments").not.toMatch(
      /collect\(result\["requirement_assessment"\]\);\s*collect\(result\["evidence"\]\);/,
    );
    expect(body, "and near-duplicates are collapsed").toMatch(/isNearDuplicate/);
  });
});
