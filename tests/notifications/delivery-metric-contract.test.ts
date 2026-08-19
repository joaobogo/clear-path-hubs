import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { deliveryReason } from "@/lib/notifications/delivery-reasons";

describe("delivery failure metric contract", () => {
  it("a suppressed recipient is not counted as a delivery failure", () => {
    const reason = deliveryReason("recipient_suppressed");
    expect(reason.countsAsFailure).toBe(false);
    expect(reason.kind).toBe("blocked");
    expect(reason.sentence.toLowerCase()).toContain("not sent");
  });

  it("every admin surface reads the shared 7-day metric, not its own count", () => {
    // Five surfaces disagreed (13 / 86 / 0) because each filtered the ledger
    // itself. Any new local re-implementation should fail here.
    const files = [
      "src/routes/_authenticated/admin.operations.tsx",
      "src/routes/_authenticated/admin.notifications.tsx",
    ];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} must use the shared hook`).toContain("useDeliveryFailures");
      expect(src, `${file} must not re-implement the query`).not.toContain(
        "listDeliveryFailures",
      );
    }
  });

  it("the canonical summary owns the window", () => {
    const src = readFileSync("src/lib/notification-failures.server.ts", "utf8");
    expect(src).toContain("blockedNotSent");
    expect(src).toContain("i.lastAttemptAt >= cutoff");
  });
});
