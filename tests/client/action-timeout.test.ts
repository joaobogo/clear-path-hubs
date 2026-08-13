import { describe, expect, it } from "vitest";
import {
  ACTION_TIMEOUT_MESSAGE,
  ActionTimeoutError,
  isActionTimeout,
  withActionTimeout,
} from "@/lib/client/action-timeout";

describe("withActionTimeout", () => {
  it("passes the value through when the action resolves in time", async () => {
    await expect(withActionTimeout(async () => "ok", 500)).resolves.toBe("ok");
  });

  it("ends a hanging action with a readable message", async () => {
    await expect(withActionTimeout(() => new Promise(() => {}), 10)).rejects.toThrow(
      ACTION_TIMEOUT_MESSAGE,
    );
  });

  it("preserves the original failure instead of masking it as a timeout", async () => {
    const err = new Error("Pick a reason so we can act on it.");
    await expect(withActionTimeout(async () => Promise.reject(err), 500)).rejects.toBe(err);
    expect(isActionTimeout(err)).toBe(false);
  });

  it("recognises its own timeout error", () => {
    expect(isActionTimeout(new ActionTimeoutError())).toBe(true);
  });
});
