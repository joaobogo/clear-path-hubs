/**
 * One-tap interview responses + calendar file generation.
 *
 * Covers the candidate-facing decision surface: which offered slots can still
 * be taken with one tap, what accept / decline / reschedule leave behind, and
 * whether the generated .ics is a valid RFC 5545 event pinned to the right
 * absolute moment with no candidate PII in it.
 */

import { describe, expect, it } from "vitest";
import { buildCandidateSlots, slotDeadlineLine } from "@/lib/candidate/interview-slots";
import { changeEligibility } from "@/lib/candidate/interview-change";
import { buildIcs, icsFilename, buildAttendDetails } from "@/lib/candidate/interview-attend";

const TZ = "Europe/London";
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

describe("one-tap slots — what the candidate can accept", () => {
  it("offers every future slot as tappable before a reply", () => {
    const slots = buildCandidateSlots({
      proposedTimes: [hoursFromNow(48), hoursFromNow(24)],
      availabilityExpiresAt: hoursFromNow(12),
      acceptedTime: null,
      candidateResponse: null,
      viewerTz: TZ,
    });
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.held && s.state === "available")).toBe(true);
    // Sorted earliest first, and the button name states date, time and zone.
    expect(new Date(slots[0]!.iso).getTime()).toBeLessThan(new Date(slots[1]!.iso).getTime());
    expect(slots[0]!.accessibleName.startsWith("Accept ")).toBe(true);
    expect(slots[0]!.label.length).toBeGreaterThan(0);
  });

  it("accepting one slot releases the others, and keeps them visible", () => {
    const chosen = hoursFromNow(24);
    const other = hoursFromNow(48);
    const slots = buildCandidateSlots({
      proposedTimes: [chosen, other],
      availabilityExpiresAt: hoursFromNow(12),
      acceptedTime: chosen,
      candidateResponse: "accepted",
      viewerTz: TZ,
    });
    const accepted = slots.find((s) => s.iso === chosen)!;
    const released = slots.find((s) => s.iso === other)!;
    expect(accepted.state).toBe("accepted");
    expect(accepted.held).toBe(false);
    expect(accepted.accessibleName).toContain("Confirmed:");
    expect(released.state).toBe("released");
    expect(released.unavailableReason).toBe("Released — you chose another time");
  });

  it("shows past slots as no longer held rather than hiding them", () => {
    const slots = buildCandidateSlots({
      proposedTimes: [hoursFromNow(-3), hoursFromNow(24)],
      availabilityExpiresAt: hoursFromNow(6),
      acceptedTime: null,
      candidateResponse: null,
      viewerTz: TZ,
    });
    expect(slots).toHaveLength(2);
    expect(slots[0]!.state).toBe("passed");
    expect(slots[0]!.held).toBe(false);
    expect(slots[0]!.unavailableReason).toBe("This time is no longer held");
    expect(slots[1]!.held).toBe(true);
  });

  it("disables every slot once the response deadline has passed", () => {
    const slots = buildCandidateSlots({
      proposedTimes: [hoursFromNow(24), hoursFromNow(48)],
      availabilityExpiresAt: hoursFromNow(-1),
      acceptedTime: null,
      candidateResponse: null,
      viewerTz: TZ,
    });
    expect(slots.every((s) => s.state === "deadline_passed" && !s.held)).toBe(true);
  });

  it("de-duplicates repeated offers and ignores blanks", () => {
    const t = hoursFromNow(24);
    const slots = buildCandidateSlots({
      proposedTimes: [t, t, ""],
      availabilityExpiresAt: null,
      acceptedTime: null,
      candidateResponse: null,
      viewerTz: TZ,
    });
    expect(slots).toHaveLength(1);
  });

  it("states the deadline in past or future tense, and stays silent without one", () => {
    expect(slotDeadlineLine(null, TZ)).toBeNull();
    expect(slotDeadlineLine(hoursFromNow(6), TZ)).toContain("Please reply by");
    expect(slotDeadlineLine(hoursFromNow(-6), TZ)).toContain("were held until");
  });
});

describe("decline / reschedule — change eligibility", () => {
  const base = Date.parse("2026-08-10T12:00:00Z");

  it("allows a change on a booked future interview", () => {
    const e = changeEligibility({
      scheduledAt: "2026-08-20T09:00:00Z",
      status: "scheduled",
      now: base,
    });
    expect(e).toEqual({ allowed: true, shortNotice: false, blockedReason: null });
  });

  it("flags short notice inside 24 hours but still allows it", () => {
    const e = changeEligibility({
      scheduledAt: "2026-08-10T20:00:00Z",
      status: "scheduled",
      now: base,
    });
    expect(e.allowed).toBe(true);
    expect(e.shortNotice).toBe(true);
  });

  it("blocks cancelled, completed and past interviews with plain reasons", () => {
    expect(changeEligibility({ scheduledAt: "2026-08-20T09:00:00Z", status: "cancelled", now: base }))
      .toMatchObject({ allowed: false, blockedReason: "This interview is cancelled." });
    expect(changeEligibility({ scheduledAt: "2026-08-20T09:00:00Z", status: "completed", now: base }))
      .toMatchObject({ allowed: false, blockedReason: "This interview has taken place." });
    expect(changeEligibility({ scheduledAt: "2026-08-01T09:00:00Z", status: "scheduled", now: base }).allowed)
      .toBe(false);
  });

  it("offers no controls, and no error, when nothing is booked yet", () => {
    const e = changeEligibility({ scheduledAt: null, status: "scheduling", now: base });
    expect(e).toEqual({ allowed: false, shortNotice: false, blockedReason: null });
  });

  it("treats an unparseable time as nothing booked rather than throwing", () => {
    expect(changeEligibility({ scheduledAt: "not-a-date", status: "scheduled", now: base }).allowed)
      .toBe(false);
  });
});

describe(".ics generation", () => {
  const ics = buildIcs({
    uid: "iv-123",
    title: "Interview: Sales Manager",
    startIso: "2026-09-01T14:30:00Z",
    durationMinutes: 45,
    location: "12 King St, London; floor 3",
    url: "https://meet.example.com/abc",
    description: "Video call\nBring nothing.",
  });
  const lines = ics.split("\r\n");

  it("is a single well-formed VEVENT calendar", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//TaaSFlow//Interview//EN");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(1);
  });

  it("uses CRLF line endings, as the spec requires", () => {
    expect(ics.includes("\r\n")).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("pins the event to the right absolute moment in UTC", () => {
    expect(ics).toContain("DTSTART:20260901T143000Z");
    // 14:30 + 45 minutes = 15:15.
    expect(ics).toContain("DTEND:20260901T151500Z");
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });

  it("defaults to a 60 minute event when no duration is recorded", () => {
    const out = buildIcs({
      uid: "iv-9",
      title: "Interview",
      startIso: "2026-09-01T14:00:00Z",
      durationMinutes: null,
    });
    expect(out).toContain("DTSTART:20260901T140000Z");
    expect(out).toContain("DTEND:20260901T150000Z");
  });

  it("escapes semicolons, commas and newlines in text fields", () => {
    expect(ics).toContain("LOCATION:12 King St\\, London\\; floor 3");
    expect(ics).toContain("Video call\\nBring nothing.");
    expect(ics).not.toMatch(/DESCRIPTION:[^\r\n]*[^\\]\n/);
  });

  it("carries a stable domain-qualified UID and a 30 minute reminder", () => {
    expect(ics).toContain("UID:iv-123@taasflow.com");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("END:VALARM");
  });

  it("omits optional fields entirely when the record has none", () => {
    const out = buildIcs({
      uid: "iv-4",
      title: "Interview",
      startIso: "2026-09-01T14:00:00Z",
      durationMinutes: 30,
    });
    expect(out).not.toContain("LOCATION:");
    expect(out).not.toContain("URL:");
    expect(out).not.toContain("DESCRIPTION:Interview");
  });

  it("folds long lines to 75 octets with a leading space on continuations", () => {
    const out = buildIcs({
      uid: "iv-5",
      title: `Interview ${"x".repeat(200)}`,
      startIso: "2026-09-01T14:00:00Z",
      durationMinutes: 30,
    });
    const outLines = out.split("\r\n");
    expect(outLines.every((l) => l.length <= 75)).toBe(true);
    const summaryIndex = outLines.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(outLines[summaryIndex + 1]!.startsWith(" ")).toBe(true);
    // Unfolding restores the original value.
    const unfolded = out.replace(/\r\n /g, "");
    expect(unfolded).toContain(`SUMMARY:Interview ${"x".repeat(200)}`);
  });

  it("leaks no candidate identity into the calendar file", () => {
    const details = buildAttendDetails({
      interviewType: "video",
      scheduledAt: "2026-09-01T14:30:00Z",
      durationMinutes: 45,
      meetingUrl: "https://meet.example.com/abc",
      location: null,
      people: [{ role: "Hiring manager", name: "Dana Reyes" }],
      viewerTz: TZ,
    });
    const out = buildIcs({
      uid: "iv-6",
      title: "Interview: Sales Manager",
      startIso: details.whenLine ? "2026-09-01T14:30:00Z" : "2026-09-01T14:30:00Z",
      durationMinutes: details.durationMinutes,
      url: details.joinUrl,
      description: details.formatLine,
    });
    expect(out).not.toContain("Dana Reyes");
    expect(out).not.toContain("@qa.taasflow.test");
    expect(out).not.toMatch(/ATTENDEE/);
  });

  it("produces a safe, readable filename", () => {
    expect(icsFilename("Interview: Sales Manager / Acme!")).toBe("interview-sales-manager-acme.ics");
    expect(icsFilename("")).toBe("interview.ics");
    expect(icsFilename("!!!")).toBe("interview.ics");
  });
});
