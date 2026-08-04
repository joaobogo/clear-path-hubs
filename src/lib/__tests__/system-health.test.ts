import { describe, expect, it } from "vitest";
import {
  freshnessWord,
  hiddenSignal,
  hoursSince,
  isAttention,
  newest,
  signal,
  STATE_LABEL,
  summarise,
  unknownSignal,
  type HealthSignal,
} from "@/lib/system-health/system-health";

const NOW = new Date("2026-08-04T12:00:00.000Z");

function measured(state: HealthSignal["state"], detail = "detail"): HealthSignal {
  return signal("agents", {
    state,
    evidence: "measured",
    detail,
    measured_at: NOW.toISOString(),
    count: null,
    actions: [],
  });
}

describe("system health summarise", () => {
  it("never claims operational without measured signals", () => {
    const out = summarise([unknownSignal("agents", "nothing yet")], NOW);
    expect(out.overall).toBe("unknown");
    expect(out.headline).toMatch(/Not enough activity/);
  });

  it("reports unknown for an empty signal set", () => {
    expect(summarise([], NOW).overall).toBe("unknown");
  });

  it("does not treat a hidden signal as healthy", () => {
    const out = summarise([hiddenSignal("integrations", "an admin")], NOW);
    expect(out.overall).toBe("unknown");
  });

  it("claims operational only from measured signals", () => {
    const out = summarise([measured("operational"), unknownSignal("sync", "n/a")], NOW);
    expect(out.overall).toBe("operational");
    expect(out.headline).toMatch(/1 checked signal/);
  });

  it("escalates action_required above everything else", () => {
    const out = summarise(
      [measured("operational"), measured("waiting_approval"), measured("action_required", "fix me")],
      NOW,
    );
    expect(out.overall).toBe("action_required");
    expect(out.headline).toContain("fix me");
    expect(out.attention_count).toBe(1);
  });

  it("counts multiple attention signals once, without one alert per signal", () => {
    const out = summarise([measured("degraded", "a"), measured("delayed", "b")], NOW);
    expect(out.overall).toBe("degraded");
    expect(out.attention_count).toBe(2);
    expect(out.headline).toMatch(/1 other signal needs a look/);
  });

  it("surfaces waiting for approval over processing", () => {
    const out = summarise([measured("processing"), measured("waiting_approval", "2 waiting")], NOW);
    expect(out.overall).toBe("waiting_approval");
    expect(out.headline).toBe("2 waiting");
  });

  it("reports processing when work is running and nothing waits on a person", () => {
    expect(summarise([measured("processing"), measured("operational")], NOW).overall).toBe(
      "processing",
    );
  });

  it("raises alerts only for delayed, degraded and action_required", () => {
    expect(isAttention("delayed")).toBe(true);
    expect(isAttention("degraded")).toBe(true);
    expect(isAttention("action_required")).toBe(true);
    expect(isAttention("operational")).toBe(false);
    expect(isAttention("processing")).toBe(false);
    expect(isAttention("waiting_approval")).toBe(false);
    expect(isAttention("unknown")).toBe(false);
    expect(isAttention("unavailable")).toBe(false);
  });
});

describe("truthful unknown and unavailable states", () => {
  it("labels every state with words, not just colour", () => {
    expect(STATE_LABEL.unknown).toBe("Not measured yet");
    expect(STATE_LABEL.unavailable).toBe("Not available to you");
    expect(Object.values(STATE_LABEL).every((v) => v.length > 0)).toBe(true);
  });

  it("marks unknown signals as not measured with no actions", () => {
    const s = unknownSignal("scoring", "no scores yet");
    expect(s.evidence).toBe("not_measured");
    expect(s.state).toBe("unknown");
    expect(s.actions).toEqual([]);
    expect(s.measured_at).toBeNull();
  });

  it("points a hidden signal at who to ask", () => {
    const s = hiddenSignal("sync", "a workspace admin");
    expect(s.state).toBe("unavailable");
    expect(s.detail).toContain("a workspace admin");
  });
});

describe("freshness helpers", () => {
  it("measures hours since a timestamp", () => {
    expect(hoursSince("2026-08-04T09:00:00.000Z", NOW)).toBe(3);
    expect(hoursSince(null, NOW)).toBeNull();
    expect(hoursSince("not-a-date", NOW)).toBeNull();
  });

  it("picks the newest timestamp and ignores blanks", () => {
    expect(newest(null, "2026-08-01T00:00:00.000Z", "2026-08-03T00:00:00.000Z")).toBe(
      "2026-08-03T00:00:00.000Z",
    );
    expect(newest(null, undefined)).toBeNull();
  });

  it("words freshness for humans", () => {
    expect(freshnessWord(0.2)).toBe("in the last hour");
    expect(freshnessWord(5)).toBe("5h ago");
    expect(freshnessWord(50)).toBe("2 days ago");
  });
});
