/**
 * A published timeline either has a job behind it, or says it does not.
 *
 * /security publishes four retention periods — CVs purged at 90 days, profiles
 * anonymised at two years, submissions anonymised at two years, logs kept 12
 * months — each badged PUBLISHED POLICY and traced to Privacy Notice §8. The
 * badge is honest about where the commitment comes from. Nothing enforces any
 * of them: `retention_runs` and `retention_policies` have no writers and no
 * readers anywhere in the application, and there is no scheduled job. A reader
 * takes a deletion timeline as operative (audit 1 Sep, F41).
 *
 * The page's own standard is what makes this a finding rather than an opinion.
 * It opens by promising "where something is not in place yet, it says so", and
 * carries a "What we do not claim" section written precisely to disclose gaps —
 * which disclosed certification and penetration testing, and not this.
 *
 * This test holds the two together: while no retention machinery exists, the
 * page must disclose that. If someone implements the job, this test fails and
 * points at the disclosure to remove — so the page cannot end up understating
 * the product either.
 */
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { filesMatching } from "@tests/helpers/scan-source";
import { TRUST_SECTIONS } from "@/config/trust-center";

const SRC = join(process.cwd(), "src");

/** Tables the retention job would have to touch to do anything at all. */
const RETENTION_TABLES = [/from\(["']retention_runs["']\)/, /from\(["']retention_policies["']\)/];

function retentionMachineryExists(): boolean {
  return RETENTION_TABLES.some(
    (re) => filesMatching(SRC, re, { exclude: [/__tests__/, /integrations\/supabase\/types\.ts/] }).length > 0,
  );
}

const retention = TRUST_SECTIONS.find((s) => s.id === "data-retention");
const notClaimed = TRUST_SECTIONS.find((s) => s.id === "not-claimed");

describe("the retention section matches the machinery", () => {
  it("has a retention section and a disclosure section to reconcile", () => {
    expect(retention, "trust-center lost its data-retention section").toBeTruthy();
    expect(notClaimed, "trust-center lost its 'What we do not claim' section").toBeTruthy();
  });

  it("does not present unenforced timelines as settled practice", () => {
    if (retentionMachineryExists()) {
      // Someone shipped the job — this is the reminder to promote the section
      // back to `documented` and drop the disclosure below, so the page stops
      // understating what the product does.
      expect(
        retention!.state,
        "retention is now enforced by code — promote this section to 'documented' and remove the 'No automatic deletion' claim",
      ).toBe("documented");
      return;
    }
    expect(
      retention!.state,
      "retention periods are published with nothing enforcing them; the section must not read as settled",
    ).toBe("in-progress");
    expect(retention!.note, "an in-progress section must say what happens meanwhile").toBeTruthy();
  });

  it("discloses the gap in the section written to disclose gaps", () => {
    if (retentionMachineryExists()) return;
    const claims = (notClaimed!.claims ?? []).map((c) => c.text.toLowerCase());
    expect(
      claims.some((t) => t.includes("automatic deletion") || t.includes("scheduled job")),
      "'What we do not claim' lists certifications and pen-testing but not the retention gap",
    ).toBe(true);
  });

  it("still publishes the periods themselves", () => {
    // Disclosing the gap must not become an excuse to delete the commitment.
    // The policy is real and the reader is entitled to see it.
    const texts = (retention!.claims ?? []).map((c) => c.text).join(" ");
    expect(texts).toMatch(/90 days/);
    expect(texts).toMatch(/two years/);
    expect(texts).toMatch(/12 months/);
  });
});
