import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * Action-wiring contract for every dashboard action (shortlist, reject,
 * request interview, schedule, publish, message, download CV, bulk download,
 * invite teammate, change stage, edit profile, upload CV, and the rest).
 *
 * Each action must:
 *   1. run through a server function (no direct client-side table writes),
 *   2. expose a pending signal so the control can't be double-fired,
 *   3. surface a real failure — a rejected mutation with no `onError` shows
 *      nothing at all, which the user reads as success,
 *   4. never announce success for a server result that reported failure.
 */

const list = (cmd: string) =>
  execSync(cmd, { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);

const mutationFiles = list("rg -l 'useMutation' src -g'!**/__tests__/**'");

type Block = { file: string; line: number; name: string; block: string };

function mutationBlocks(): Block[] {
  const out: Block[] = [];
  for (const file of mutationFiles) {
    const s = readFileSync(file, "utf8");
    const re = /useMutation\s*(<[^(]*?>)?\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const lineStart = s.lastIndexOf("\n", m.index) + 1;
      const prefix = s.slice(lineStart, m.index);
      if (/^\s*import\b/.test(prefix)) continue; // the import statement itself
      const open = s.indexOf("{", m.index + m[0].length - 1);
      if (open === -1) continue;
      let depth = 0;
      let end = open;
      for (let i = open; i < s.length; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const named = /(?:const|let)\s+([A-Za-z0-9_$]+)\s*(?::[^=]*)?=\s*$/.exec(prefix);
      out.push({
        file,
        line: s.slice(0, m.index).split("\n").length,
        name: named?.[1] ?? "(anonymous)",
        block: s.slice(open, end + 1),
      });
    }
  }
  return out;
}

const blocks = mutationBlocks();

describe("dashboard action wiring", () => {
  it("finds the action surface", () => {
    expect(blocks.length).toBeGreaterThan(150);
  });

  it("gives every action a visible failure path", () => {
    const silent = blocks
      .filter((b) => !/onError/.test(b.block))
      .map((b) => `${b.file}:${b.line} (${b.name})`);
    expect(silent, "mutations without onError fail silently").toEqual([]);
  });

  it("gives every action a pending signal", () => {
    const missing: string[] = [];
    for (const b of blocks) {
      if (b.name === "(anonymous)") continue;
      const s = readFileSync(b.file, "utf8");
      const used = new RegExp(
        `${b.name}\\.(isPending|isLoading|status)|${b.name}Pending|busy|disabled`,
      ).test(s);
      if (!used) missing.push(`${b.file}:${b.line} (${b.name})`);
    }
    expect(missing, "actions with no pending/disabled state can double-fire").toEqual([]);
  });

  it("never writes to the database straight from a component or route", () => {
    const direct = list(
      "rg -n --no-heading \"supabase\\.from\\(\" src/components src/routes -g'!**/__tests__/**' || true",
    ).filter((l) => /\.(insert|update|upsert|delete)\(/.test(l));
    expect(direct, "client-side writes bypass server-side validation").toEqual([]);
  });

  it("does not announce success for a server result that reported failure", () => {
    // Server functions that resolve with a failure payload instead of throwing.
    const softFail = new Set<string>();
    for (const file of list("rg -l 'createServerFn' src -g'!**/__tests__/**'")) {
      const s = readFileSync(file, "utf8");
      const re = /export const ([A-Za-z0-9_$]+)\s*=\s*createServerFn/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(s))) {
        const next = s.indexOf("\nexport const", m.index + 10);
        const body = s.slice(m.index, next === -1 ? s.length : next);
        if (/ok:\s*false|success:\s*false|\berror:\s*["'`]|status:\s*"failed"/.test(body)) {
          softFail.add(m[1]!);
        }
      }
    }

    const unguarded: string[] = [];
    for (const b of blocks) {
      const called = [...b.block.matchAll(/([A-Za-z0-9_$]+)\s*\(/g)].map((x) => x[1]!);
      if (!called.some((c) => softFail.has(c))) continue;
      const success = /onSuccess[\s\S]*/.exec(b.block)?.[0] ?? "";
      const guarded = /\.ok|res\.error|"error" in|\berror\b|if \(/.test(success);
      if (/toast\.success/.test(success) && !guarded) {
        unguarded.push(`${b.file}:${b.line} (${b.name})`);
      }
    }
    expect(unguarded, "success toast fires regardless of the server verdict").toEqual([]);
  });
});
