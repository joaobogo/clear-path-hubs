import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EVENTS,
  defaultPreferences,
  isModeAllowed,
  normalizePreferences,
} from "@/lib/client-notification-prefs";

describe("client notification preferences", () => {
  it("never allows a service notice to be switched off", () => {
    for (const spec of NOTIFICATION_EVENTS.filter((e) => e.lockedReason)) {
      expect(isModeAllowed(spec.key, "off")).toBe(false);
      expect(isModeAllowed(spec.key, "daily")).toBe(true);
      expect(isModeAllowed(spec.key, "immediate")).toBe(true);
    }
  });

  it("has no all-or-nothing switch — every event carries its own choice", () => {
    const defaults = defaultPreferences();
    expect(Object.keys(defaults)).toHaveLength(NOTIFICATION_EVENTS.length);
    for (const spec of NOTIFICATION_EVENTS) {
      expect(spec.modes.length).toBeGreaterThan(1);
      expect(spec.modes).toContain(defaults[spec.key]);
    }
  });

  it("falls back to defaults for missing or invalid stored values", () => {
    const prefs = normalizePreferences({
      pref_shortlist_delivered: "daily",
      pref_decision_overdue: "off", // not permitted -> default stands
      pref_offer_response: "nonsense",
    });
    expect(prefs.pref_shortlist_delivered).toBe("daily");
    expect(prefs.pref_decision_overdue).toBe("immediate");
    expect(prefs.pref_offer_response).toBe("immediate");
  });
});
