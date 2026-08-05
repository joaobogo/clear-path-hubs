import { describe, expect, it } from "vitest";
import {
  buildAttendDetails,
  buildIcs,
  icsFilename,
  looksLikeStreetAddress,
  mapUrlFor,
} from "@/lib/candidate/interview-attend";

const base = {
  interviewType: "video" as string | null,
  scheduledAt: "2026-09-01T13:00:00.000Z",
  durationMinutes: 45,
  meetingUrl: null as string | null,
  location: null as string | null,
  people: [] as Array<{ role: string | null; name: string | null }>,
  viewerTz: "Europe/London",
};

describe("interview attend details", () => {
  it("never invents a join link or address", () => {
    const d = buildAttendDetails(base);
    expect(d.joinUrl).toBeNull();
    expect(d.address).toBeNull();
    expect(d.mapUrl).toBeNull();
  });

  it("treats a URL in location as a join link, not a place", () => {
    const d = buildAttendDetails({ ...base, location: "https://meet.example.com/abc" });
    expect(d.joinUrl).toBe("https://meet.example.com/abc");
    expect(d.address).toBeNull();
  });

  it("maps only real street addresses", () => {
    expect(looksLikeStreetAddress("Meeting room 4")).toBe(false);
    expect(looksLikeStreetAddress("12 King St, London, EC1A 1AA")).toBe(true);
    expect(mapUrlFor("Meeting room 4")).toBeNull();
    expect(mapUrlFor("12 King St, London, EC1A 1AA")).toContain("google.com/maps");
  });

  it("renders time in the viewer zone with the offset", () => {
    expect(buildAttendDetails(base).whenLine).toContain("Europe/London");
  });

  it("gives no prepare notes when the format is unknown", () => {
    expect(buildAttendDetails({ ...base, interviewType: null }).prepare).toEqual([]);
  });

  it("builds an ics with UTC stamps and a filename", () => {
    const ics = buildIcs({ uid: "abc", title: "Interview · Chef", startIso: base.scheduledAt, durationMinutes: 45 });
    expect(ics).toContain("DTSTART:20260901T130000Z");
    expect(ics).toContain("DTEND:20260901T134500Z");
    expect(icsFilename("Interview · Chef")).toBe("interview-chef.ics");
  });
});
