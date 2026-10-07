import { describe, expect, it } from "vitest";
import {
  bookingIntakeSchema,
  intakeAnswers,
  quickBookingSchema,
  quickBookingToIntake,
} from "@/lib/booking/booking-schema";

const base = { firstName: "Ada", lastName: "Example", email: "Ada@Example-Co.com", phone: "" };

describe("quick booking optional role", () => {
  it("is optional and changes nothing when absent", () => {
    const parsed = quickBookingSchema.parse(base);
    expect(parsed.role).toBe("");
    const intake = quickBookingToIntake(parsed);
    expect(intake.rolesHiring).toBe("Not provided yet");
    expect(intake.additionalContext).toBeNull();
    expect(bookingIntakeSchema.safeParse(intake).success).toBe(true);
  });

  it("carries the role into the stored intake and CRM text", () => {
    const parsed = quickBookingSchema.parse({ ...base, role: "  Hotel General Manager " });
    const intake = quickBookingToIntake(parsed);
    expect(intake.rolesHiring).toBe("Hotel General Manager");
    expect(intakeAnswers(intake)["Additional context"]).toContain("Hotel General Manager");
    expect(bookingIntakeSchema.safeParse(intake).success).toBe(true);
  });

  it("rejects more than 120 characters and strips markup characters", () => {
    expect(quickBookingSchema.safeParse({ ...base, role: "x".repeat(121) }).success).toBe(false);
    const parsed = quickBookingSchema.parse({ ...base, role: "<script>Chef</script>" });
    expect(parsed.role).not.toMatch(/[<>]/);
  });
});
