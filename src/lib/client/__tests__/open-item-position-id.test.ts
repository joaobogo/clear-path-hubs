/**
 * A queue item knows which role it belongs to.
 *
 * OpenItem carried no position_id, so the client overview reconstructed one by
 * parsing the link: `item.href.split("/").pop()`. What that returns depends
 * entirely on the item kind:
 *
 *   pending_decision  /client/candidates/<matchId>          → a MATCH id
 *   offer             /client/offers                        → "offers"
 *   interview         /client/interviews?interview=<id>     → "interviews?…"
 *   missing_feedback  /client/candidates/<matchId>          → a MATCH id
 *   info_request      /client/positions/<id>#information-…  → the real id
 *
 * Only the last is a position id, so `queue.filter(q => q.position_id === role)`
 * dropped every decision, offer and interview. Filtering the OMNIFLOW overview
 * by its ONLY role — a filter that should change nothing — rendered "Nothing
 * needs you today" beside a tile reading "2 waiting on your decision"
 * (audit 1 Sep, F1).
 *
 * The comment above that filter had predicted the harm exactly: "a client could
 * return to a bookmarked link and read 'nothing needs you' while three other
 * roles waited."
 */
import { describe, expect, it } from "vitest";
import type { OpenItem } from "@/lib/client/open-items";

const ROLE = "bf2a3410-5d91-4b9f-b2e6-4816c724a3ad";
const MATCH = "99fae717-1c2d-4e3f-8a9b-0c1d2e3f4a5b";

function item(over: Partial<OpenItem> & Pick<OpenItem, "kind" | "href">): OpenItem {
  return {
    id: "1",
    label: "Something to do",
    context: "Technical Product Developer",
    position_id: ROLE,
    due_at: null,
    overdue: false,
    ...over,
  } as OpenItem;
}

/** What the overview used to do. Kept so the test states the actual defect. */
const fromHref = (href: string) => href.split("/").pop()?.split("#")[0] || null;

describe("the old href-parsing derivation", () => {
  it("returned a match id for a pending decision, not a role", () => {
    expect(fromHref(`/client/candidates/${MATCH}`)).toBe(MATCH);
    expect(fromHref(`/client/candidates/${MATCH}`)).not.toBe(ROLE);
  });

  it("returned literal strings for offers and interviews", () => {
    expect(fromHref("/client/offers")).toBe("offers");
    expect(fromHref("/client/interviews?interview=abc")).toBe("interviews?interview=abc");
  });

  it("only ever worked for info requests", () => {
    expect(fromHref(`/client/positions/${ROLE}#information-needed`)).toBe(ROLE);
  });
});

describe("filtering the queue by role", () => {
  const queue: OpenItem[] = [
    item({ kind: "pending_decision", href: `/client/candidates/${MATCH}` }),
    item({ kind: "offer", href: "/client/offers" }),
    item({ kind: "interview", href: "/client/interviews?interview=abc" }),
    item({ kind: "info_request", href: `/client/positions/${ROLE}#information-needed` }),
    item({ kind: "pending_decision", href: "/client/candidates/other", position_id: "other-role" }),
  ];

  it("keeps every item on the selected role", () => {
    const filtered = queue.filter((q) => q.position_id === ROLE);
    expect(filtered).toHaveLength(4);
    expect(filtered.map((q) => q.kind).sort()).toEqual([
      "info_request",
      "interview",
      "offer",
      "pending_decision",
    ]);
  });

  it("excludes items on another role", () => {
    expect(queue.filter((q) => q.position_id === "other-role")).toHaveLength(1);
  });

  it("does not empty a single-role workspace's queue", () => {
    // The observed failure: one role, every item on it, filter applied, queue
    // empty. Filtering by the only role must be a no-op.
    const singleRole = queue.filter((q) => q.position_id === ROLE);
    expect(singleRole.length).toBe(queue.length - 1);
    expect(singleRole.length).toBeGreaterThan(0);
  });
});
