import { afterEach, describe, expect, it } from "vitest";
import { QA_E2E_COOKIE, qaTestTrafficFromCookie } from "@/lib/public-api/qa-endpoint-gate";

const ORIGINAL_TOKEN = process.env.QA_SEED_TOKEN;

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.QA_SEED_TOKEN;
  else process.env.QA_SEED_TOKEN = ORIGINAL_TOKEN;
});

describe("qaTestTrafficFromCookie", () => {
  it("is dead outside the dev server, whatever the cookie says", () => {
    process.env.QA_SEED_TOKEN = "secret";
    expect(qaTestTrafficFromCookie(`${QA_E2E_COOKIE}=secret`, false)).toBe(false);
  });

  it("requires the cookie", () => {
    delete process.env.QA_SEED_TOKEN;
    expect(qaTestTrafficFromCookie(null, true)).toBe(false);
    expect(qaTestTrafficFromCookie("other=1", true)).toBe(false);
    expect(qaTestTrafficFromCookie(`${QA_E2E_COOKIE}=`, true)).toBe(false);
  });

  it("requires the configured token when the server has one", () => {
    process.env.QA_SEED_TOKEN = "secret";
    expect(qaTestTrafficFromCookie(`a=1; ${QA_E2E_COOKIE}=secret; b=2`, true)).toBe(true);
    expect(qaTestTrafficFromCookie(`${QA_E2E_COOKIE}=wrong`, true)).toBe(false);
  });

  it("accepts any non-empty value when no token is configured", () => {
    delete process.env.QA_SEED_TOKEN;
    expect(qaTestTrafficFromCookie(`${QA_E2E_COOKIE}=e2e`, true)).toBe(true);
  });

  it("never matches a cookie whose name merely contains the marker", () => {
    delete process.env.QA_SEED_TOKEN;
    expect(qaTestTrafficFromCookie(`x${QA_E2E_COOKIE}=e2e`, true)).toBe(false);
  });
});
