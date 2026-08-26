import { describe, it, expect } from "vitest";
import { qaEndpointsEnabled, qaEndpointDisabledResponse } from "./qa-endpoint-gate";

describe("qa-endpoint-gate", () => {
  it("is closed in a production build, whatever the environment says", () => {
    process.env["ENABLE_QA_ENDPOINTS"] = "true";
    expect(qaEndpointsEnabled(false)).toBe(false);
    delete process.env["ENABLE_QA_ENDPOINTS"];
  });

  it("is open only for the local dev server", () => {
    expect(qaEndpointsEnabled(true)).toBe(true);
  });

  it("answers 404 rather than confirming the route exists when closed", () => {
    // The suite itself runs in dev mode, so assert on an explicitly closed gate.
    const response = qaEndpointsEnabled(false) ? null : qaEndpointDisabledResponse();
    if (response === null) throw new Error("expected a 404 response");
    expect(response.status).toBe(404);
  });
});
