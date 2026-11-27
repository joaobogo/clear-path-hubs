/**
 * Scoring fix spec, 26 Nov 2026, Fix 4. The scorer reads profile text only
 * where the profile records that a person wrote it. Daniel Miles's profile
 * was rewritten in the database with no such record, so no score moved. This
 * is the staff path that writes the record with the edit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const PROFILE = "306db9b0-3af6-4c02-8679-10c646eae170";
const STAFF = "e60fd0fc-0000-4000-8000-000000000001";
const state: { profile: Row | null; updates: Row[]; audits: Row[]; staff: boolean } = {
  profile: null,
  updates: [],
  audits: [],
  staff: true,
};

const admin = {
  rpc: async () => ({ data: state.staff }),
  from: (table: string) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: state.profile, error: null }) }),
    }),
    update: (patch: Row) => ({
      eq: async () => {
        state.updates.push(patch);
        state.profile = { ...(state.profile ?? {}), ...patch };
        return { error: null };
      },
    }),
    insert: async (row: Row) => {
      if (table === "audit_events") state.audits.push(row);
      return { error: null };
    },
  }),
};
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: admin }));

import {
  editProfileNarrativeHandler,
  editProfileNarrativeValidate,
} from "../profile-narrative.functions";
import { buildProfileText, profileFieldOrigin } from "@/lib/scoring/profile-text";

const CV =
  "Dynatrace | Enterprise Account Director Oct 2015 – Dec 2018\n• Won British Airways (£1.4m ACV) and TUI (£750k ACV).";
const context = { supabase: null, userId: STAFF };
const run = (input: Row) =>
  editProfileNarrativeHandler({ data: editProfileNarrativeValidate(input), context });

beforeEach(() => {
  state.staff = true;
  state.updates = [];
  state.audits = [];
  state.profile = {
    id: PROFILE,
    headline: "HEAD OF EMEA SALES",
    summary: "EMEA sales leader.",
    experience: [
      {
        title: "Enterprise Account Director",
        company: "Dynatrace",
        start: "Oct 2015",
        end: "Dec 2018",
        summary: "",
      },
    ],
    consent: { terms: true, provenance: { summary: { source: "cv_parsed" } } },
  };
});

describe("a recruiter corrects a candidate's profile", () => {
  it("records the changed field as the recruiter's, with the reason, and leaves the rest of consent alone", async () => {
    const before = buildProfileText(state.profile as never, CV);
    expect(before).toBe("");

    const res = await run({
      candidate_profile_id: PROFILE,
      reason: "Summary rewritten from LinkedIn and a call, 26 Nov",
      summary: "Closed new-logo deals at British Airways and TUI as a hunter.",
    });
    expect(res).toEqual({ ok: true, updated: ["summary"], recorded: ["summary"] });
    expect(state.updates).toHaveLength(1);
    const consent = state.profile!.consent as Row;
    expect(consent.terms).toBe(true);
    expect((consent.provenance as Row).summary).toMatchObject({
      source: "admin_corrected",
      corrected_by: STAFF,
      note: "Summary rewritten from LinkedIn and a call, 26 Nov",
    });
    expect(profileFieldOrigin(consent, "summary")).toBe("recruiter");
    // Untouched fields keep whatever record they had.
    expect(profileFieldOrigin(consent, "experience")).toBeNull();
    // The scorer now reads the sentence, labelled as the recruiter's.
    const after = buildProfileText(state.profile as never, CV);
    expect(after).toContain("PROFILE SUMMARY (R)");
    expect(after).toContain("Closed new-logo deals at British Airways and TUI as a hunter.");

    expect(state.audits).toEqual([
      expect.objectContaining({
        actor_user_id: STAFF,
        action: "admin_profile_narrative_edit",
        entity_id: PROFILE,
        before_state: { summary: "EMEA sales leader." },
        after_state: expect.objectContaining({
          summary: "Closed new-logo deals at British Airways and TUI as a hunter.",
          recorded_as_recruiter_written: ["summary"],
        }),
      }),
    ]);
  });

  it("corrected dates are recorded on the experience entries", async () => {
    const res = await run({
      candidate_profile_id: PROFILE,
      reason: "Dates corrected to LinkedIn, 26 Nov 2026",
      experience: [
        {
          title: "Enterprise Account Director",
          company: "Dynatrace",
          start: "Dec 2015",
          end: "Nov 2018",
          summary: "",
        },
      ],
    });
    expect(res.updated).toEqual(["experience"]);
    const block = buildProfileText(state.profile as never, CV);
    expect(block).toContain("PROFILE EXPERIENCE (R)");
    expect(block).toContain("Enterprise Account Director | Dynatrace Dec 2015 – Nov 2018");
  });

  it("can record that a field already on the profile was written by a recruiter, without changing it", async () => {
    const res = await run({
      candidate_profile_id: PROFILE,
      reason: "Summary was rewritten by the recruiter on 26 Nov",
      confirm_fields: ["summary"],
    });
    expect(res).toEqual({ ok: true, updated: [], recorded: ["summary"] });
    expect(state.profile!.summary).toBe("EMEA sales leader.");
    expect(profileFieldOrigin(state.profile!.consent, "summary")).toBe("recruiter");
  });

  it("writes nothing when nothing changed, and nothing for a caller who is not staff", async () => {
    const same = await run({
      candidate_profile_id: PROFILE,
      reason: "No real change here at all",
      summary: "EMEA sales leader.",
    });
    expect(same).toEqual({ ok: true, updated: [], recorded: [] });
    expect(state.updates).toHaveLength(0);

    state.staff = false;
    await expect(
      run({ candidate_profile_id: PROFILE, reason: "Not allowed to do this", summary: "x" }),
    ).rejects.toThrow("forbidden");
    expect(state.updates).toHaveLength(0);
  });

  it("needs a reason and something to change", () => {
    expect(() =>
      editProfileNarrativeValidate({
        candidate_profile_id: PROFILE,
        reason: "short",
        summary: "x",
      }),
    ).toThrow();
    expect(() =>
      editProfileNarrativeValidate({
        candidate_profile_id: PROFILE,
        reason: "A proper reason here",
      }),
    ).toThrow();
  });
});
