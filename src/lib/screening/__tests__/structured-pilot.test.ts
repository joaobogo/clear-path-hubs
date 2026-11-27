/**
 * Structured screening pilot (spec v1, 27 Nov 2026): the rules, the flags,
 * the alert line and the scorer hook. The questions below are the ones in the
 * pilot migration for the two CLCS jobs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  answerFlags,
  normaliseAnswer,
  passes,
  payFlag,
  progress,
  questionFromRow,
  summaryLine,
  toEngineAnswers,
  validateAnswers,
  verifyFlags,
  type StructuredAnswer,
  type StructuredQuestion,
} from "../structured";
import { scoreCandidate, type RequirementInput } from "@/lib/scoring-engine.server";
import { findProtectedCriteria } from "@/lib/scoring/protected-attributes";

// The VALUES rows of the migration, read back as the database stores them.
const MIGRATION = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/20261127150000_structured_screening_pilot.sql"),
  "utf8",
);
const UK = "a781288f-cf6f-45d6-b78f-5db5a846bc15";
const NL = "f069e33b-3f83-4724-8be6-745d019de01e";

function parseRows(position: string): StructuredQuestion[] {
  const out: StructuredQuestion[] = [];
  const re = new RegExp(`\\('${position}',(.*?)\\)(?:,\\n|\\n)`, "g");
  for (const m of MIGRATION.matchAll(re)) {
    // Split the tuple on commas outside quotes.
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < m[1].length; i++) {
      const c = m[1][i];
      if (c === "'" && m[1][i + 1] === "'") {
        cur += "'";
        i++;
        continue;
      }
      if (c === "'") {
        q = !q;
        continue;
      }
      if (c === "," && !q) {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    cells.push(cur);
    const v = (x: string) => (x === "NULL" ? null : x);
    const json = (x: string) => (x === "NULL" ? null : JSON.parse(x));
    const [key, label, type, options, required, section, maps, rule, sort, help, unit, showWhen, short, staffOnly] =
      cells;
    const q2 = questionFromRow({
      key,
      label,
      type,
      options: json(options),
      required: required === "true",
      section,
      maps_to_requirement: v(maps),
      pass_rule: json(rule),
      sort_order: Number(sort),
      help: v(help),
      unit: v(unit),
      show_when: json(showWhen),
      short_label: v(short),
      staff_only: staffOnly === "true",
    });
    if (q2) out.push(q2);
  }
  return out;
}

const ukQ = parseRows(UK);
const nlQ = parseRows(NL);
const answered = (key: string, value: StructuredAnswer["value"]): StructuredAnswer => ({
  key,
  value,
  status: "answered",
  source: "candidate",
});

describe("the pilot questions as stored", () => {
  it("are the spec's: 11 for the UK job and 12 (plus one optional follow-up) for the Netherlands job", () => {
    expect(ukQ.map((q) => q.key)).toEqual([
      "linkedin_url", "based_in", "work_auth", "start", "pay_expectation",
      "largest_deal", "largest_deal_what", "bookings_target", "platforms_sold", "uk_buyer_network", "london_travel",
    ]);
    expect(nlQ.map((q) => q.key)).toEqual([
      "linkedin_url", "based_in", "work_auth", "start", "pay_expectation",
      "dutch_level", "english_level", "largest_deal", "largest_deal_what", "fs_benelux", "fs_benelux_names", "kvk", "amsterdam_travel",
    ]);
    expect(progress(ukQ, {}).total).toBe(11);
    expect(progress(nlQ, {}).total).toBe(12);
  });

  it("pass no question through the protected-attribute check", () => {
    for (const q of [...ukQ, ...nlQ]) {
      expect(findProtectedCriteria(q.label), q.label).toEqual([]);
    }
  });

  it("map each must-have question to the role's own wording", () => {
    const uk = ukQ.filter((q) => q.maps_to_requirement).map((q) => q.maps_to_requirement);
    expect(uk).toContain("Has personally closed enterprise deals of $2M+ in total contract value");
    expect(uk).toContain("Based in or commutable to London, and able to travel up to 50%");
    const nl = nlQ.filter((q) => q.maps_to_requirement).map((q) => q.maps_to_requirement);
    expect(nl.filter((t) => t === "Fluent in Dutch and English at a professional level")).toHaveLength(2);
  });
});

describe("pass rules (spec sections 6b and 6c)", () => {
  const q = (list: StructuredQuestion[], key: string) => list.find((x) => x.key === key)!;
  it("follow the spec", () => {
    expect(passes(q(ukQ, "largest_deal"), "$2-5M")).toBe(true);
    expect(passes(q(ukQ, "largest_deal"), "$5M+")).toBe(true);
    expect(passes(q(ukQ, "largest_deal"), "$1-2M")).toBe(false);
    expect(passes(q(ukQ, "platforms_sold"), ["Snowflake", "Databricks"])).toBe(true);
    expect(passes(q(ukQ, "platforms_sold"), ["Snowflake"])).toBe(false);
    expect(passes(q(ukQ, "platforms_sold"), ["None"])).toBe(false);
    expect(passes(q(ukQ, "uk_buyer_network"), "6-15")).toBe(true);
    expect(passes(q(ukQ, "uk_buyer_network"), "1-5")).toBe(false);
    expect(passes(q(nlQ, "dutch_level"), "Professional")).toBe(true);
    expect(passes(q(nlQ, "dutch_level"), "Basic")).toBe(false);
    expect(passes(q(nlQ, "kvk"), "No, but willing")).toBe(true);
    expect(passes(q(nlQ, "kvk"), "No")).toBe(false);
    expect(passes(q(ukQ, "london_travel"), true)).toBe(true);
    expect(passes(q(ukQ, "start"), "1 month")).toBeNull();
  });

  it("validate answers the way the form sends them", () => {
    expect(normaliseAnswer(q(ukQ, "platforms_sold"), ["None", "Snowflake"]).ok).toBe(false);
    expect(normaliseAnswer(q(ukQ, "largest_deal_what"), "x".repeat(151)).ok).toBe(false);
    expect(normaliseAnswer(q(ukQ, "pay_expectation"), { min: 140000, max: null })).toEqual({
      ok: true,
      value: { min: 140000, max: 140000 },
    });
    // The follow-up is dropped unless its question was answered yes.
    const res = validateAnswers(nlQ, [
      { key: "work_auth", value: true },
      { key: "dutch_level", value: "Native" },
      { key: "english_level", value: "Professional" },
      { key: "largest_deal", value: "$2-5M" },
      { key: "largest_deal_what", value: "Data platform migration, Dutch bank" },
      { key: "fs_benelux", value: false },
      { key: "fs_benelux_names", value: "ING" },
      { key: "kvk", value: "Yes" },
      { key: "amsterdam_travel", value: true },
    ]);
    expect(res.ok && res.answers.map((a) => a.key)).not.toContain("fs_benelux_names");
    // A required question left out is refused with its wording.
    const missing = validateAnswers(ukQ, [{ key: "work_auth", value: true }]);
    expect(missing).toEqual({ ok: false, message: 'Please answer: "Largest deal you personally closed (total contract value)"' });
  });
});

describe("flags (spec section 8)", () => {
  it("Dutch = Basic raises a Dutch flag; nothing is rejected", () => {
    const answers = [answered("dutch_level", "Basic"), answered("english_level", "Native"), answered("kvk", "Yes")];
    const flags = answerFlags(nlQ, answers);
    expect(flags).toEqual([{ kind: "must_have", key: "dutch_level", label: "Dutch", message: "Dutch: Basic" }]);
  });

  it("a question that was never asked raises no flag", () => {
    const notAsked: StructuredAnswer[] = nlQ.map((q) => ({ key: q.key, value: null, status: "not_asked", source: "candidate" }));
    expect(answerFlags(nlQ, notAsked)).toEqual([]);
    expect(toEngineAnswers(nlQ, notAsked)).toEqual([]);
  });

  it("pay above the role's range is a soft flag, and only once there is a range", () => {
    const pay = [answered("pay_expectation", { min: 180000, max: 200000 })];
    expect(payFlag(ukQ, pay, { min: null, max: null })).toBeNull();
    expect(payFlag(ukQ, pay, { min: 120000, max: 170000 })?.kind).toBe("pay");
    expect(payFlag(ukQ, pay, { min: 120000, max: 190000 })).toBeNull();
  });

  it("the alert line reads like the spec's example", () => {
    const answers = [
      answered("work_auth", true),
      answered("dutch_level", "Professional"),
      answered("english_level", "Native"),
      answered("largest_deal", "$2-5M"),
      answered("largest_deal_what", "data migration, Dutch bank"),
      answered("fs_benelux", true),
      answered("fs_benelux_names", "ING, NN"),
      answered("kvk", "Yes"),
      answered("amsterdam_travel", true),
      answered("pay_expectation", { min: 15000, max: 18000 }),
    ];
    expect(summaryLine(nlQ, answers, answerFlags(nlQ, answers))).toBe(
      "Can work in the Netherlands: Yes | Dutch: Professional | English: Native | Largest deal: $2-5M (data migration, Dutch bank) | Financial services in Benelux: Yes (ING, NN) | KvK: Yes | Amsterdam and travel: Yes | Flags: none",
    );
  });
});

describe("the scorer", () => {
  const reqs: RequirementInput[] = [
    { id: "req-0", text: "Has personally closed enterprise deals of $2M+ in total contract value", required: true, keywords: [] },
    { id: "req-1", text: "Fluent in Dutch and English at a professional level", required: true, keywords: [] },
    { id: "req-2", text: "Works, or will work, as an independent consultant through own KvK-registered business", required: true, keywords: [] },
  ];
  const cv = `Jane Example\nAmsterdam, Netherlands\nEXPERIENCE\nAccount Director, Example Software BV, Jan 2018 – Present\n- Sold data platform services to enterprise customers.\n- Managed a portfolio of strategic accounts across the Benelux.`;
  const base = { cv_text: cv, requirements: reqs, as_of: new Date("2026-11-27T00:00:00Z") };

  it("gives a passing answer full credit, and asks the reviewer to verify what the CV does not show", () => {
    const answers = [
      answered("largest_deal", "$2-5M"),
      answered("dutch_level", "Native"),
      answered("english_level", "Professional"),
      answered("kvk", "Yes"),
    ];
    const r = scoreCandidate({ ...base, screening: toEngineAnswers(nlQ, answers) });
    const row = (id: string) => r.requirement_assessment.find((a) => a.id === id)!;
    expect(row("req-0").status).toBe("met");
    expect(row("req-1").status).toBe("met");
    expect(row("req-2").status).toBe("met");
    expect(verifyFlags(nlQ, r.requirement_assessment).map((f) => f.key)).toEqual(["largest_deal"]);
    // Never capped or disqualified by a pilot answer.
    expect(r.disqualifying_answers).toEqual([]);
  });

  it("Dutch and English must both pass for the language must-have; a fail never caps the score", () => {
    const answers = [answered("dutch_level", "Basic"), answered("english_level", "Native")];
    const r = scoreCandidate({ ...base, screening: toEngineAnswers(nlQ, answers) });
    expect(r.requirement_assessment.find((a) => a.id === "req-1")!.status).not.toBe("met");
    expect(r.disqualifying_answers).toEqual([]);
    expect(r.applied_caps.filter((c) => c.reason.startsWith("disqualifying_answer"))).toEqual([]);
  });

  it("scores nothing differently for answers without the pilot marker", () => {
    const plain = scoreCandidate({ ...base, screening: [] });
    const again = scoreCandidate({ ...base, screening: [] });
    expect(again.score).toBe(plain.score);
    expect(again.input_hash).toBe(plain.input_hash);
  });
});
