import { describe, it, expect } from "vitest";
import { qaEndpointDisabledResponse } from "./qa-endpoint-gate";

describe("qa-endpoint-gate", () => {
  it("returns 404 when ENABLE_QA_ENDPOINTS is unset", () => {
    const original = process.env["ENABLE_QA_ENDPOINTS"];
    delete process.env["ENABLE_QA_ENDPOINTS"];
    const response = qaEndpointDisabledResponse();
    if (response === null) throw new Error("expected 404 response");
    expect(response.status).toBe(404);
    process.env["ENABLE_QA_ENDPOINTS"] = original;
  });

  it("returns null when ENABLE_QA_ENDPOINTS is truthy", () => {
    const original = process.env["ENABLE_QA_ENDPOINTS"];
    process.env["ENABLE_QA_ENDPOINTS"] = "true";
    expect(qaEndpointDisabledResponse()).toBeNull();
    process.env["ENABLE_QA_ENDPOINTS"] = original;
  });
});
