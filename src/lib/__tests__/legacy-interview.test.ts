import { describe, expect, it } from "vitest";
import { pickLegacyInterview } from "@/lib/candidate/legacy-interview";

const now = Date.parse("2026-08-10T10:00:00Z");

describe("legacy interview note for the candidate", () => {
  it("shows the next future scheduled interview with its link", () => {
    const note = pickLegacyInterview(
      [
        { status: "scheduled", scheduled_at: "2026-08-20T10:00:00Z", meeting_url: "https://meet.example/x", timezone: "Europe/Lisbon" },
        { status: "scheduled", scheduled_at: "2026-08-12T10:00:00Z", meeting_url: null },
      ],
      now,
    );
    expect(note).toEqual({ scheduled_at: "2026-08-12T10:00:00Z", timezone: null, join_url: null });
  });

  it("ignores past, cancelled and requested rows, and non-http links", () => {
    expect(
      pickLegacyInterview(
        [
          { status: "scheduled", scheduled_at: "2026-08-01T10:00:00Z" },
          { status: "cancelled", scheduled_at: "2026-08-20T10:00:00Z" },
          { status: "requested", scheduled_at: null },
        ],
        now,
      ),
    ).toBeNull();
    expect(
      pickLegacyInterview(
        [{ status: "scheduled", scheduled_at: "2026-08-20T10:00:00Z", meeting_url: "javascript:alert(1)" }],
        now,
      )?.join_url,
    ).toBeNull();
  });
});
