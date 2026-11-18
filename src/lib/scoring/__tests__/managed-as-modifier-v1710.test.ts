/**
 * v1.7.10 — Billing Manager role (18 Nov 2026).
 *
 * "Provide financial and customer support to corporate and managed hotel
 * teams" was read as a team managed: "managed" sat within four words of
 * "teams". It describes hotels run under management contracts. An -ed word
 * after a preposition or determiner, alone or coordinated with another
 * modifier, is no longer the verb; every verb use still counts.
 *
 * Also: reviewer-entered evidence is stored in the database's source_kind
 * vocabulary ("manual"), shown as "Reviewer verified".
 */
import { describe, expect, it } from "vitest";
import { evaluateYearsRequirement } from "@/lib/scoring/structured-requirements";
import { parseYearsSubject } from "@/lib/scoring/years-subject";
import { ENGINE_VERSION } from "@/lib/scoring/engine-version";
import { EVIDENCE_ITEM_SOURCE_KINDS, MANUAL_EVIDENCE_SNAPSHOT } from "@/lib/evidence/completeness";
import { humanizeSource } from "@/lib/evidence/quote-hygiene";

const TODAY = new Date("2026-11-18T00:00:00Z");
const TEAM_YEARS = "2+ years managing a team";
const team = parseYearsSubject(TEAM_YEARS)!;
const describesTeam = (line: string) => team.strong.test(line);

const HOTEL_BILLING_CV = [
  "Jordan Example",
  "PROFESSIONAL EXPERIENCE",
  "Manager, Financial Services and Billing | Example Hotels – Parsippany, NJ 2013–Present",
  "• Calculate and bill monthly management fees for managed hotels using management-agreement rates.",
  "• Provide financial and customer support to corporate and managed hotel teams across North America and internationally.",
  "General Accountant | Example Downtown Hotel – New York, NY 2002–2013",
  "• Processed payments and routed receipts to appropriate accounts.",
].join("\n");

describe("v1.7.10 — 'managed' describing a noun is not managing people", () => {
  it("is the team subject", () => {
    expect(team.kind).toBe("team");
  });

  it("the hotel line no longer describes a team managed", () => {
    expect(
      describesTeam(
        "Provide financial and customer support to corporate and managed hotel teams across North America and internationally.",
      ),
    ).toBe(false);
    expect(describesTeam("Liaison for the managed services team.")).toBe(false);
    expect(describesTeam("Billing support across owned and managed hotel teams.")).toBe(false);
  });

  it("every verb use still counts", () => {
    expect(describesTeam("Hired and managed a team of 6 billing specialists.")).toBe(true);
    expect(describesTeam("Recruited, trained and managed 5 staff.")).toBe(true);
    expect(describesTeam("I managed 5 staff in accounts receivable.")).toBe(true);
    expect(describesTeam("Responsible for managing three billers.")).toBe(true);
    expect(describesTeam("Managed hotel teams across 12 properties.")).toBe(true);
    expect(describesTeam("Supervised 14 staff across two offices.")).toBe(true);
    expect(describesTeam("Owned and managed a team of four collectors.")).toBe(true);
  });

  it("a manager whose only team line is the hotel line is partial, not met", () => {
    const v = evaluateYearsRequirement(TEAM_YEARS, HOTEL_BILLING_CV, TODAY)!;
    expect(v.status).toBe("partial");
    expect(v.note).toContain("from a title alone, with no team described");
  });

  it("bumps the engine version", () => {
    expect(ENGINE_VERSION).toBe("taasflow-scoring-v1.7.10");
  });
});

describe("reviewer-entered evidence", () => {
  it("uses the database's source_kind vocabulary", () => {
    // candidate_evidence_items_source_kind_check
    expect([...EVIDENCE_ITEM_SOURCE_KINDS]).toEqual([
      "cv",
      "application_answer",
      "interview",
      "manual",
    ]);
    expect(MANUAL_EVIDENCE_SNAPSHOT).toBe("manual-review");
  });

  it("shows a manual entry as Reviewer verified", () => {
    expect(humanizeSource("manual")).toBe("Reviewer verified");
  });
});
