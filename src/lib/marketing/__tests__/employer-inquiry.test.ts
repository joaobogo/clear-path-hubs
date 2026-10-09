import { describe, expect, it } from "vitest";
import {
  DEDUPE_WINDOW_MS,
  EmployerInquiryInput,
  escapeText,
  inquiryErrorCategory,
  isDuplicate,
  normaliseEmail,
  normalisePhone,
  prepareInquiry,
  validateInquiryFields,
} from "@/lib/marketing/employer-inquiry";

const KEY = "3b241101-e2bb-4255-8caf-4136c566a962";
const valid = { firstName: "Ana", email: "Ana@Example.com ", phone: "", position: "Senior accountant" };

describe("validateInquiryFields", () => {
  it("accepts a minimal valid inquiry with no phone", () => {
    expect(validateInquiryFields(valid)).toEqual({});
  });

  it("does not reject personal email domains", () => {
    expect(validateInquiryFields({ ...valid, email: "founder@gmail.com" })).toEqual({});
  });

  it("requires first name, email and position", () => {
    const errors = validateInquiryFields({ firstName: " ", email: "nope", phone: "", position: "" });
    expect(Object.keys(errors).sort()).toEqual(["email", "firstName", "position"]);
    expect(inquiryErrorCategory(errors)).toBe("multiple_fields");
  });

  it("accepts international phone numbers and rejects junk", () => {
    expect(normalisePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalisePhone("+55 11 91234-5678")).toBe("+5511912345678");
    expect(normalisePhone("")).toBe("");
    expect(normalisePhone("call me")).toBeNull();
    expect(normalisePhone("123")).toBeNull();
    expect(validateInquiryFields({ ...valid, phone: "abc" }).phone).toBeTruthy();
  });

  it("reports an error category, never the value", () => {
    expect(inquiryErrorCategory({ email: "x" })).toBe("email_invalid");
    expect(inquiryErrorCategory({})).toBe("none");
  });
});

describe("server input and preparation", () => {
  const input = { ...valid, source: "pilot-hero", idempotencyKey: KEY, website: "" };

  it("normalises email and strips empty phone", () => {
    const clean = prepareInquiry(EmployerInquiryInput.parse(input))!;
    expect(clean.email).toBe("ana@example.com");
    expect(clean.phone).toBeNull();
    expect(normaliseEmail(" A@B.CO ")).toBe("a@b.co");
  });

  it("stores raw text without HTML entities and strips control characters", () => {
    const clean = prepareInquiry(
      EmployerInquiryInput.parse({ ...input, firstName: "O'Brien", position: "R&D Engineer\u0007" }),
    )!;
    expect(clean.firstName).toBe("O'Brien");
    expect(clean.position).toBe("R&D Engineer");
    expect(escapeText("a'b")).toBe("a&#39;b");
  });

  it("rejects over-long fields, a missing key and a filled honeypot", () => {
    expect(() => EmployerInquiryInput.parse({ ...input, position: "x".repeat(201) })).toThrow();
    expect(() => EmployerInquiryInput.parse({ ...input, idempotencyKey: "abc" })).toThrow();
    expect(() => EmployerInquiryInput.parse({ ...input, website: "http://spam" })).toThrow();
  });

  it("returns null for an implausible phone", () => {
    expect(prepareInquiry(EmployerInquiryInput.parse({ ...input, phone: "12" }))).toBeNull();
  });
});

describe("idempotency and dedupe", () => {
  const clean = prepareInquiry(
    EmployerInquiryInput.parse({ ...valid, source: "x", idempotencyKey: KEY }),
  )!;
  const now = Date.parse("2026-10-07T12:00:00Z");
  const row = (over: Record<string, unknown> = {}) => ({
    id: "1",
    email: "ana@example.com",
    role_title: "Senior accountant",
    created_at: new Date(now - 60_000).toISOString(),
    details: {},
    ...over,
  });

  it("treats the same client key as a duplicate at any age", () => {
    const old = row({ details: { idempotency_key: KEY }, created_at: new Date(now - 9e8).toISOString() });
    expect(isDuplicate(old, clean, now)).toBe(true);
  });

  it("treats identical email and position inside ten minutes as a duplicate", () => {
    expect(isDuplicate(row(), clean, now)).toBe(true);
  });

  it("allows the same email and position after the window", () => {
    const late = row({ created_at: new Date(now - DEDUPE_WINDOW_MS - 1000).toISOString() });
    expect(isDuplicate(late, clean, now)).toBe(false);
  });

  it("allows a different position and no prior row", () => {
    expect(isDuplicate(row({ role_title: "Nurse" }), clean, now)).toBe(false);
    expect(isDuplicate(null, clean, now)).toBe(false);
  });
});
