import { describe, expect, it } from "vitest";
import { looksTechnical } from "@/lib/error-taxonomy";
import { panelErrorMessage } from "@/components/admin/panel-state";

describe("database enum errors never reach the screen", () => {
  it("classifies a Postgres enum error as technical", () => {
    expect(
      looksTechnical('invalid input value for enum processing_state: "cancelled"'),
    ).toBe(true);
    expect(looksTechnical('invalid input syntax for type uuid: "abc"')).toBe(true);
  });

  it("replaces the enum error with human copy in a panel", () => {
    const msg = panelErrorMessage(
      new Error('invalid input value for enum processing_state: "cancelled"'),
    );
    expect(msg).not.toMatch(/enum|processing_state|cancelled/i);
    expect(msg).toMatch(/couldn't load/i);
  });

  it("keeps human copy intact", () => {
    expect(panelErrorMessage(new Error("This client has no roles yet."))).toBe(
      "This client has no roles yet.",
    );
  });
});
