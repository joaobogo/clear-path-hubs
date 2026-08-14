import { describe, expect, it } from "vitest";
import { normaliseDeliveryStatus } from "@/lib/notifications/delivery-state";

describe("normaliseDeliveryStatus", () => {
  it("treats a provider-accepted send as sent", () => {
    expect(normaliseDeliveryStatus("provider_accepted")).toBe("sent");
  });

  it("keeps blocked recipients distinct from our own failures", () => {
    expect(normaliseDeliveryStatus("suppressed")).toBe("suppressed");
    expect(normaliseDeliveryStatus("failed")).toBe("failed");
  });

  it("ignores unknown statuses", () => {
    expect(normaliseDeliveryStatus("weird")).toBeNull();
  });
});
