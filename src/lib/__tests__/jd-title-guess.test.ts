import { describe, expect, it } from "vitest";
import { guessTitleAndTeam } from "@/lib/jd-title-guess";

describe("guessTitleAndTeam", () => {
  it("reads labelled lines", () => {
    const jd = "Acme\nJob title: Senior Accountant\nTeam: Finance Operations\nWe are hiring.";
    expect(guessTitleAndTeam(jd)).toEqual({ title: "Senior Accountant", team: "Finance Operations" });
  });

  it("reads a title-shaped first line and a department line", () => {
    const jd = "# Clinical Operations Manager\n\nDepartment – Clinical Operations\nYou will lead the unit.";
    expect(guessTitleAndTeam(jd)).toEqual({ title: "Clinical Operations Manager", team: "Clinical Operations" });
  });

  it("does not turn company boilerplate or a sentence into a title", () => {
    expect(guessTitleAndTeam("About us\nWe build things.").title).toBeUndefined();
    expect(guessTitleAndTeam("We are looking for a hotel general manager to lead our property.").title).toBeUndefined();
    expect(guessTitleAndTeam("Job Description").title).toBeUndefined();
  });

  it("never invents a team from prose", () => {
    expect(guessTitleAndTeam("Hotel General Manager\nYou will lead the team of 40.").team).toBeUndefined();
  });

  it("handles empty input", () => {
    expect(guessTitleAndTeam("")).toEqual({});
    expect(guessTitleAndTeam("   \n  ")).toEqual({});
  });
});
