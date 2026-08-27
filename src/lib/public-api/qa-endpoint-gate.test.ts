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
    // The suite runs in dev mode, so the gate has to be closed explicitly.
    // Passing it to qaEndpointsEnabled was not enough — the response helper
    // re-read the build mode itself and always returned null here.
    const response = qaEndpointDisabledResponse(false);
    if (response === null) throw new Error("expected a 404 response");
    expect(response.status).toBe(404);
  });

  it("stays open for the dev server it exists for", () => {
    expect(qaEndpointDisabledResponse(true)).toBeNull();
  });

  it("says nothing about the route it is hiding", async () => {
    const response = qaEndpointDisabledResponse(false)!;
    // A body naming the route, or anything but a plain 404, confirms to a
    // prober that the endpoint is real and merely switched off.
    expect(await response.text()).toBe("Not Found");
  });
});
