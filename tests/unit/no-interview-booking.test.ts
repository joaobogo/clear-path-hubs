/**
 * Guard: nothing in TaaSFlow lets a client request, schedule, propose times for
 * or book an interview. Interviews are arranged off the system. A client may
 * still move a candidate to the interview STAGE and leave feedback.
 *
 * Static scan, no shell. Two checks:
 *  (a) the only server code that writes a new `interviews` row is
 *      src/lib/interview-record.server.ts (a completed-feedback record).
 *  (b) user-visible string literals in client, candidate and public route
 *      screens never use booking language.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sourceFiles } from "@tests/helpers/scan-source";

const NOT_TESTS = [/__tests__\//, /\.test\.tsx?$/];

/** Remove block and line comments. `//` inside a URL is kept (needs a non-colon before it). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
}

// ─── (a) server paths ──────────────────────────────────────────────────────

/** The one place allowed to create an interviews row. */
const INTERVIEW_WRITERS_ALLOWED = new Set(["src/lib/interview-record.server.ts"]);

describe("no server path creates a requested/scheduling/scheduled interview", () => {
  const files = [
    ...sourceFiles("src/lib", { exclude: NOT_TESTS }),
    ...sourceFiles("src/routes", { exclude: NOT_TESTS }),
    ...sourceFiles("src/components", { exclude: NOT_TESTS }),
    ...sourceFiles("src/hooks", { exclude: NOT_TESTS }),
  ];

  it("only interview-record.server.ts inserts into interviews", () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (INTERVIEW_WRITERS_ALLOWED.has(file)) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      // from("interviews") followed (within the same builder chain) by insert/upsert.
      const re = /\.from\(\s*["'`]interviews["'`]\s*\)([\s\S]{0,400}?)(?=\.from\(|;\s*\n)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(code))) {
        if (/\.(insert|upsert)\s*\(/.test(m[1])) offenders.push(file);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("no code calls an RPC that books, schedules or requests an interview", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      if (/\.rpc\(\s*["'`][a-z_]*(interview|schedul|book_|request_slot|propose)[a-z_]*["'`]/i.test(code)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the allowed writer only creates the lightweight feedback record", () => {
    const code = stripComments(readFileSync("src/lib/interview-record.server.ts", "utf8"));
    // It may insert as "scheduled" only to satisfy the lifecycle trigger, and must complete it.
    expect(code).not.toMatch(/status:\s*["'](requested|scheduling)["']/);
    expect(code).toMatch(/step\(\s*created\.id as string,\s*"completed"\s*\)/);
    // Reachable only for a candidate already at (or past) the interview stage.
    expect(code).toContain("match_not_at_interview_stage");
  });

  it("no server function or route is named for requesting or scheduling an interview", () => {
    const offenders: string[] = [];
    const re =
      /export\s+(?:const|async function|function)\s+(\w*(?:request|schedule|reschedule|book|propose|offer)\w*(?:interview|slot|availability)\w*|\w*(?:interview|slot)\w*(?:request|schedule|reschedule|book|propose)\w*)\b/gi;
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const m of code.matchAll(re)) offenders.push(`${file}: ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });
});

// ─── (b) user-visible copy ─────────────────────────────────────────────────

const FORBIDDEN: Array<{ label: string; re: RegExp }> = [
  { label: "request an interview", re: /\brequest(?:ed|ing)? an? interview/i },
  { label: "Interview requested", re: /\binterview requested\b/i },
  { label: "Interview request(s)", re: /\binterview requests?\b/i },
  { label: "schedule an interview", re: /\bschedul(?:e|ed|ing) (?:an?|the|your|their) interview/i },
  { label: "book an interview", re: /\bbook(?:ed|ing)? (?:an?|the|your|their) interview/i },
  { label: "pick a time", re: /\bpick a time\b/i },
  { label: "propose times", re: /\bpropos(?:e|ed|ing) (?:a )?times?\b/i },
  // Bare "availability" is a candidate profile field (notice period / start date) and is fine.
  // Flag it only when it is about interview times.
  {
    label: "availability",
    re: /\b(?:your|share|submit|add|set|provide|send) (?:your |their )?(?:interview )?availability\b|\binterview availability\b|\bavailability (?:for|to) (?:an? |the )?interview|\bavailability (?:slots?|windows?|calendar)\b/i,
  },
  { label: "confirm a time", re: /\bconfirm (?:a |the |your )?(?:new )?time\b/i },
  { label: "would like to interview you", re: /would like to interview you/i },
];

/**
 * Files that may use a forbidden phrase, with the reason. Keep this short.
 * An entry is a path prefix; a value is the phrase labels it may use.
 */
const ALLOWED: Record<string, { labels: string[]; reason: string }> = {
  // No file needs an exception today. Add one here, with a reason, rather than
  // weakening a pattern.
};

function allowed(file: string, label: string): boolean {
  return Object.entries(ALLOWED).some(
    ([prefix, a]) => file.startsWith(prefix) && a.labels.includes(label),
  );
}

/** String literals and JSX text in a source file, with comments removed. */
function visibleStrings(src: string): Array<{ line: number; text: string }> {
  const code = stripComments(src);
  const out: Array<{ line: number; text: string }> = [];
  const lineOf = (idx: number) => code.slice(0, idx).split("\n").length;
  const literal = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  for (const m of code.matchAll(literal)) {
    out.push({ line: lineOf(m.index ?? 0), text: m[1] ?? m[2] ?? m[3] ?? "" });
  }
  const jsx = />([^<>{}\n][^<>{}]*)</g;
  for (const m of code.matchAll(jsx)) {
    out.push({ line: lineOf(m.index ?? 0), text: m[1] });
  }
  return out;
}

describe("no booking language in user-visible copy", () => {
  const files = [
    ...sourceFiles("src/components/client", { exclude: NOT_TESTS }),
    ...sourceFiles("src/components/candidate", { exclude: NOT_TESTS }),
    ...sourceFiles("src/routes", {
      exclude: [...NOT_TESTS, /^src\/routes\/blog/, /^src\/routes\/api\//, /^src\/routes\/intake\.tsx$/],
    }),
    ...sourceFiles("src/lib/email-templates", { exclude: NOT_TESTS }),
  ];

  it("scans a real set of files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("uses stage language, never request/schedule/book/propose-times language", () => {
    const hits: string[] = [];
    for (const file of files) {
      for (const s of visibleStrings(readFileSync(file, "utf8"))) {
        for (const f of FORBIDDEN) {
          if (f.re.test(s.text) && !allowed(file, f.label)) {
            hits.push(`${file}:${s.line} [${f.label}] ${s.text.trim().slice(0, 100)}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("notification and activity copy for retired events is neutral", async () => {
    const { CLIENT_COPY, CANDIDATE_COPY, ADMIN_COPY, RETIRED_SCHEDULING_EVENTS } = await import(
      "@/lib/events"
    );
    const entries = [CLIENT_COPY, CANDIDATE_COPY, ADMIN_COPY].flatMap((c) =>
      Object.entries(c ?? {}),
    ) as Array<[string, { title: string; body?: string }]>;
    const bad: string[] = [];
    for (const [key, v] of entries) {
      const text = `${v.title} ${v.body ?? ""}`;
      if (FORBIDDEN.some((f) => f.re.test(text))) bad.push(`${key}: ${text}`);
    }
    expect(bad).toEqual([]);
    expect(RETIRED_SCHEDULING_EVENTS.has("interview_requested")).toBe(true);
  });
});
