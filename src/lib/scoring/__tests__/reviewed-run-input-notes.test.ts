/**
 * Scoring fix spec, 26 Nov 2026, Fix 6: "the run's explanation says
 * 'screening answered by recruiter, pending candidate confirmation'". For a
 * reviewed candidate the run every surface reads is the reviewed one, and its
 * explanation dropped the sentence (and the corrected-dates note) that the
 * machine run under it carried.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));

import { inputNotes } from "../human-adjusted-run.server";
import { SCREENING_BY_RECRUITER_NOTE } from "@/lib/candidate/answer-source";

describe("what a reviewed run says about its inputs", () => {
  it("keeps the recruiter-entered answers sentence and the corrected-dates note", () => {
    const dates =
      "Dates corrected by recruiter: Dynatrace Dec 2015 – Nov 2018 (CV: Oct 2015 – Dec 2018).";
    expect(
      inputNotes({
        screening_source: { candidate: 0, recruiter_on_behalf: 5 },
        profile_evidence: { recruiter_edited: true, date_corrections: [], note: dates },
      }),
    ).toEqual([SCREENING_BY_RECRUITER_NOTE, dates]);
    expect(SCREENING_BY_RECRUITER_NOTE).toBe(
      "screening answered by recruiter, pending candidate confirmation",
    );
  });

  it("says nothing when the candidate answered personally and no dates were corrected", () => {
    expect(inputNotes({ screening_source: { candidate: 5, recruiter_on_behalf: 0 } })).toEqual([]);
    expect(inputNotes({ profile_evidence: { note: null } })).toEqual([]);
    expect(inputNotes({})).toEqual([]);
    expect(inputNotes(null)).toEqual([]);
  });
});
