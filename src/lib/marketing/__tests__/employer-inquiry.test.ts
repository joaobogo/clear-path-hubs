import { describe, expect, it } from "vitest";
import {
  DEDUPE_WINDOW_MS,
  EmployerInquiryInput,
  escapeText,
  inquiryErrorCategory,
  isDuplicate,
  normaliseEmail,
  normaliseJobDescriptionUrl,
  normalisePhone,
  prepareInquiry,
  validateInquiryFields,
} from "@/lib/marketing/employer-inquiry";

const KEY = "3b241101-e2bb-4255-8caf-4136c566a962";
const valid = {
  firstName: "Ana",
  email: "Ana@Example.com ",
  phone: "+44 20 7946 0958",
  jobDescriptionUrl: "https://company.com/careers/senior-accountant",
};

describe("validateInquiryFields", () => {
  it("accepts a complete inquiry", () => {
    expect(validateInquiryFields(valid)).toEqual({});
  });

  it("does not reject personal email domains", () => {
    expect(validateInquiryFields({ ...valid, email: "founder@gmail.com" })).toEqual({});
  });

  it("requires every field: first name, email, phone and the job description link", () => {
    const errors = validateInquiryFields({ firstName: " ", email: "nope", phone: "", jobDescriptionUrl: "" });
    expect(Object.keys(errors).sort()).toEqual(["email", "firstName", "jobDescriptionUrl", "phone"]);
    expect(inquiryErrorCategory(errors)).toBe("multiple_fields");
  });

  it("accepts international phone numbers and rejects junk or an empty phone", () => {
    expect(normalisePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalisePhone("+55 11 91234-5678")).toBe("+5511912345678");
    expect(normalisePhone("call me")).toBeNull();
    expect(normalisePhone("123")).toBeNull();
    expect(validateInquiryFields({ ...valid, phone: "abc" }).phone).toBeTruthy();
    expect(validateInquiryFields({ ...valid, phone: "" }).phone).toBeTruthy();
  });

  it("accepts a job description link with or without a scheme, and rejects anything that is not a link", () => {
    expect(normaliseJobDescriptionUrl("company.com/careers/role")).toBe("https://company.com/careers/role");
    expect(normaliseJobDescriptionUrl(" https://jobs.example.co.uk/123 ")).toBe("https://jobs.example.co.uk/123");
    expect(normaliseJobDescriptionUrl("senior accountant")).toBeNull();
    expect(normaliseJobDescriptionUrl("ftp://company.com/jd.pdf")).toBeNull();
    expect(normaliseJobDescriptionUrl("javascript:alert(1)")).toBeNull();
    expect(normaliseJobDescriptionUrl("https://user:pw@company.com/role")).toBeNull();
    expect(normaliseJobDescriptionUrl("localhost/role")).toBeNull();
    expect(validateInquiryFields({ ...valid, jobDescriptionUrl: "senior accountant" }).jobDescriptionUrl).toBeTruthy();
  });

  it("reports an error category, never the value", () => {
    expect(inquiryErrorCategory({ email: "x" })).toBe("email_invalid");
    expect(inquiryErrorCategory({})).toBe("none");
  });
});

describe("server input and preparation", () => {
  const input = { ...valid, source: "pilot-hero", idempotencyKey: KEY, website: "" };

  it("normalises email, phone and the link", () => {
    const clean = prepareInquiry(EmployerInquiryInput.parse(input))!;
    expect(clean.email).toBe("ana@example.com");
    expect(clean.phone).toBe("+442079460958");
    expect(clean.jobDescriptionUrl).toBe("https://company.com/careers/senior-accountant");
    expect(normaliseEmail(" A@B.CO ")).toBe("a@b.co");
  });

  it("stores raw text without HTML entities and strips control characters", () => {
    const clean = prepareInquiry(EmployerInquiryInput.parse({ ...input, firstName: "O'Brien\u0007" }))!;
    expect(clean.firstName).toBe("O'Brien");
    expect(escapeText("a'b")).toBe("a&#39;b");
  });

  it("rejects an empty phone or link, over-long fields, a missing key and a filled honeypot", () => {
    expect(() => EmployerInquiryInput.parse({ ...input, phone: "" })).toThrow();
    expect(() => EmployerInquiryInput.parse({ ...input, jobDescriptionUrl: "" })).toThrow();
    expect(() => EmployerInquiryInput.parse({ ...input, jobDescriptionUrl: `https://c.com/${"x".repeat(2100)}` })).toThrow();
    expect(() => EmployerInquiryInput.parse({ ...input, idempotencyKey: "abc" })).toThrow();
    expect(() => EmployerInquiryInput.parse({ ...input, website: "http://spam" })).toThrow();
  });

  it("returns null for an implausible phone or a link that is not a link", () => {
    expect(prepareInquiry(EmployerInquiryInput.parse({ ...input, phone: "12" }))).toBeNull();
    expect(prepareInquiry(EmployerInquiryInput.parse({ ...input, jobDescriptionUrl: "senior accountant" }))).toBeNull();
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
    created_at: new Date(now - 60_000).toISOString(),
    details: { job_description_url: "https://company.com/careers/senior-accountant" },
    ...over,
  });

  it("treats the same client key as a duplicate at any age", () => {
    const old = row({ details: { idempotency_key: KEY }, created_at: new Date(now - 9e8).toISOString() });
    expect(isDuplicate(old, clean, now)).toBe(true);
  });

  it("treats identical email and link inside ten minutes as a duplicate", () => {
    expect(isDuplicate(row(), clean, now)).toBe(true);
  });

  it("allows the same email and link after the window", () => {
    const late = row({ created_at: new Date(now - DEDUPE_WINDOW_MS - 1000).toISOString() });
    expect(isDuplicate(late, clean, now)).toBe(false);
  });

  it("allows a different link and no prior row", () => {
    expect(isDuplicate(row({ details: { job_description_url: "https://company.com/careers/nurse" } }), clean, now)).toBe(false);
    expect(isDuplicate(null, clean, now)).toBe(false);
  });
});
