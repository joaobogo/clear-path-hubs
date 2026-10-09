/**
 * TaaSFlow delivers the list. Interviews, offers and hires happen directly
 * between the client and the candidate, outside the product.
 *
 * The client workspace therefore has no "Move to interview", "Make offer" or
 * "Mark hired" action anywhere: not on a card, a row, the detail page, the
 * decision bar or the decision dialog, and no Interviews or Offers screen in
 * the navigation. The interview, offer and hired stages still exist, but only
 * as tracking columns on the candidates board.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { advanceFor as cardAdvance } from "@/components/client/candidate-primary-action";
import { advanceFor as barAdvance } from "@/components/client/decision-bar";
import { ACTIONS_BY_STAGE } from "@/components/client/candidate-detail/actions";
import { CLIENT_SECTION_GROUPS } from "@/config/workspace-sections";
import { buildPipelineActionTarget } from "@/lib/client-pipeline-language";

const TRACKED_ONLY = ["shortlisted", "interview_process", "offer", "hired"] as const;
const REMOVED_ACTIONS = ["request_interview", "offer", "hire"];

describe("one-click advance buttons", () => {
  it.each(TRACKED_ONLY)("offer nothing from the %s stage on a card or row", (stage) => {
    expect(cardAdvance(stage)).toBeNull();
  });
  it.each(TRACKED_ONLY)("offer nothing from the %s stage in the decision bar", (stage) => {
    expect(barAdvance(stage)).toBeNull();
  });
  it("still let a client shortlist a new arrival and reopen a declined one", () => {
    expect(cardAdvance("delivered")?.action).toBe("shortlist");
    expect(cardAdvance("not_moving_forward")?.action).toBe("shortlist");
    expect(barAdvance("delivered")?.action).toBe("shortlist");
    expect(barAdvance("not_moving_forward")?.action).toBe("shortlist");
  });
});

describe("candidate detail stage actions", () => {
  it("never include an interview, offer or hire action at any stage", () => {
    for (const [stage, def] of Object.entries(ACTIONS_BY_STAGE)) {
      const keys = [def.primary?.key, ...def.more.map((a) => a.key)].filter(Boolean);
      for (const removed of REMOVED_ACTIONS) {
        expect(keys, `${stage} exposes ${removed}`).not.toContain(removed);
      }
    }
  });
  it("keep decline reachable from every open stage", () => {
    for (const stage of ["delivered", "shortlisted", "interview_process", "offer"] as const) {
      expect(ACTIONS_BY_STAGE[stage].more.map((a) => a.key)).toContain("not_moving_forward");
    }
  });
});

describe("client navigation", () => {
  it("has no Interviews or Offers screen", () => {
    const tabs = CLIENT_SECTION_GROUPS.flatMap((g) => g.tabs);
    expect(tabs.map((t) => t.to)).not.toContain("/client/interviews");
    expect(tabs.map((t) => t.to)).not.toContain("/client/offers");
    expect(tabs.map((t) => t.label.toLowerCase())).not.toContain("interviews");
    expect(tabs.map((t) => t.label.toLowerCase())).not.toContain("offers");
  });
  it("sends an outstanding offer to the board, not to an offers screen", () => {
    const target = buildPipelineActionTarget({
      status: "active",
      awaitingReview: 0,
      offers: 1,
      positionId: "pos-1",
    });
    expect(target?.to).toBe("/client/candidates");
    expect(target && "search" in target ? target.search.view : null).toBe("board");
  });
});

/** Every client-facing source file: components and routes. */
function clientSources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === "__tests__") continue;
        walk(full);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        out.push(full);
      }
    }
  };
  walk(join(process.cwd(), "src/components/client"));
  for (const name of readdirSync(join(process.cwd(), "src/routes/_authenticated"))) {
    if (name.startsWith("client.") && /\.tsx?$/.test(name)) {
      out.push(join(process.cwd(), "src/routes/_authenticated", name));
    }
  }
  return out;
}

describe("client-facing copy", () => {
  const forbidden = [
    /Make (an )?offer/,
    /Extend (an )?offer/,
    /Mark (as )?hired/,
    /Move to (the )?interview stage/,
    /Advance to (interview|offer)/,
    /Request (an )?interview/,
    /Schedule (an )?interview/,
    /Book (an )?interview/,
    /to="\/client\/(interviews|offers)"/,
  ];
  it("never names an interview, offer or hire action", () => {
    const hits: string[] = [];
    for (const file of clientSources()) {
      const text = readFileSync(file, "utf8");
      for (const re of forbidden) {
        if (re.test(text)) hits.push(`${file.replace(process.cwd() + "/", "")}: ${re}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
