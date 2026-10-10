import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeParams } from "@/lib/tracking/fgv-events";
import { leadFormEventParams, safeErrorCategory } from "@/lib/tracking/lead-form-events";

const read = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("lead form events", () => {
  it("carries only form type, placement and an error category", () => {
    const params = sanitizeParams(leadFormEventParams("pilot-hero", "email_invalid"));
    expect(params).toEqual({
      form_type: "employer_inquiry",
      referral_context: "pilot-hero",
      error_code: "email_invalid",
    });
  });

  it("never lets an email or phone through, even if passed as a category", () => {
    expect(safeErrorCategory("ana@example.com")).toBe("unknown");
    const params = sanitizeParams(leadFormEventParams("home", "+44 20 7946 0958"));
    expect(JSON.stringify(params)).not.toMatch(/@|\d{7}/);
  });

  it("drops personal keys if a caller adds them", () => {
    const params = sanitizeParams({ ...leadFormEventParams("home"), email: "a@b.co", phone: "+4420794609" });
    expect(params).not.toHaveProperty("email");
    expect(params).not.toHaveProperty("phone");
  });
});

describe("EmployerInquiryForm contract", () => {
  const src = read("src/components/marketing/employer-inquiry-form.tsx");

  it("shows success only after the server accepted the inquiry", () => {
    const submitAt = src.indexOf("await submit(");
    const okAt = src.indexOf("if (!result.ok)");
    const doneAt = src.indexOf("setDone(true)");
    expect(submitAt).toBeGreaterThan(-1);
    expect(okAt).toBeGreaterThan(submitAt);
    expect(doneAt).toBeGreaterThan(okAt);
    expect(src.match(/setDone\(true\)/g)).toHaveLength(1);
  });

  it("fires generate_lead only through the confirmed-conversion helper, after success", () => {
    expect(src.indexOf("trackConfirmedConversion({")).toBeGreaterThan(src.indexOf("setDone(true)"));
  });

  it("has an accessible honeypot and an aria-live error summary", () => {
    expect(src).toContain('style={{ display: "none" }}');
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain("tabIndex={-1}");
    expect(src).toContain('autoComplete="off"');
    expect(src).toContain('aria-live="assertive"');
  });

  it("uses the shared CTA label and the agreed copy", () => {
    expect(src).toContain("CTA_PILOT_REQUEST.label");
    expect(src).toContain("Your request has been received");
    expect(src).not.toContain("Choose a time");
    expect(src).toContain("We will contact you within one business day to confirm the role and the pilot scope.");
    expect(src).toContain("What role do you need to fill?");
  });
});

describe("funnel pages", () => {
  it("/pilot uses the new headline and no retired labels", () => {
    const src = read("src/routes/pilot.tsx");
    expect(src).toContain("One role. Ten candidates. Five days.");
    expect(src).toContain('source="pilot-hero"');
    expect(src).not.toMatch(/Start the pilot intake|Start intake|Day 3|free trial|weekly/i);
  });

  it("/intake is noindex,follow and there is no public booking route", () => {
    expect(read("src/routes/intake.tsx")).toContain('content: "noindex, follow"');
    expect(existsSync(join(process.cwd(), "src/routes/book.tsx"))).toBe(false);
  });

  it("/intake relabels the paying button and drops the contradiction", () => {
    const src = read("src/routes/intake.tsx");
    expect(src).toContain('"Submit the role and pay"');
    expect(src).not.toContain("Start now — pay and publish");
    expect(src).not.toContain("No payment today. Nothing is charged to start.");
  });

  it("/contact renders every panel and uses one response time", () => {
    const src = read("src/routes/contact.tsx");
    expect(src).toContain("INTENTS.map((intent)");
    expect(src).toContain("hidden={intent.id !== intentId}");
    expect(src).not.toMatch(/responseSla|Same business day|Within 4 business hours/);
  });
});
