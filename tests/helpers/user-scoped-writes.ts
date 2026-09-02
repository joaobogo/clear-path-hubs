/**
 * Find writes to a table that travel on the END USER'S JWT.
 *
 * Column-level GRANTs apply to the `authenticated` role and to nothing else.
 * A write on the privileged server client (service_role) bypasses them
 * entirely. So "will this write survive the grant?" is exactly the question
 * "is this receiver the user's client?" — and that question has two traps,
 * both of which produced a wrong answer while writing these guards:
 *
 *   1. THE RECEIVER NAME PROVES NOTHING. processing.functions.ts binds
 *      `const supabase = await getAdmin()` — service_role, despite the name —
 *      while scoring.functions.ts had `const { supabase } = context`, a user
 *      JWT with the same name. Exempting on the identifier marks the dangerous
 *      one safe. The binding is resolved instead.
 *
 *   2. THE PATCH IS NOT ALWAYS A LITERAL. client-settings.functions.ts builds
 *      `const patch = { ... }` and calls `.update(patch)`. A scanner that only
 *      reads `.update({ ... })` silently sees no columns and reports the file
 *      as clean — which is how a guard passes while the thing it guards is
 *      broken. Identifier patches are resolved back to their declaration.
 *
 * Whole-file matching, not line-by-line: these call chains span newlines, so a
 * per-line scan matches nothing and every guard built on it passes vacuously.
 */
import { readFileSync } from "node:fs";
import { sourceFiles } from "./scan-source";

export type UserScopedWrite = {
  /** Repo-relative, forward slashes. */
  file: string;
  line: number;
  /** The identifier the query was called on. */
  receiver: string;
  /** Columns the patch sets. Empty when the patch could not be resolved. */
  columns: string[];
  /** True when the patch was an identifier that could not be resolved. */
  unresolved: boolean;
};

const rel = (p: string) => p.replace(process.cwd(), "").replace(/^[/\\]/, "").replace(/\\/g, "/");

/**
 * Top-level keys of an object literal.
 *
 * Depth-aware on purpose. A flat regex for `key:` also matches keys of nested
 * objects, keys inside an IIFE in a value position, and object types in a cast —
 * reporting column names that do not exist on the table, which reads as a
 * violation and sends you hunting for a column nobody writes.
 */
function columnsOf(objectLiteral: string): string[] {
  const body = objectLiteral.trim().replace(/^\{/, "").replace(/\}$/, "");
  const keys: string[] = [];
  let depth = 0;
  let atKeyPosition = true;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === "{" || c === "[" || c === "(") depth += 1;
    else if (c === "}" || c === "]" || c === ")") depth -= 1;
    else if (c === "," && depth === 0) atKeyPosition = true;
    else if (depth === 0 && atKeyPosition && /[A-Za-z_]/.test(c)) {
      const key = body.slice(i).match(/^(\w+)\s*:/);
      if (key) keys.push(key[1]);
      atKeyPosition = false;
    }
  }
  return keys;
}

/**
 * Nearest binding of `name` above `offset`, whether by assignment or by
 * destructuring. Nearest wins: a name can be re-bound within a file.
 */
function nearestBinding(before: string, name: string): string | undefined {
  const assign = [...before.matchAll(new RegExp(`\\b(?:const|let)\\s+${name}\\s*=\\s*[^;\\n]+`, "g"))];
  const destructure = [
    ...before.matchAll(new RegExp(`\\b(?:const|let)\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*[^;\\n]+`, "g")),
  ];
  return [...assign, ...destructure]
    .map((m) => m[0])
    .sort((a, b) => before.lastIndexOf(a) - before.lastIndexOf(b))
    .pop();
}

/** Every `.update(...)` / `.upsert(...)` on `table` carried on a user JWT. */
export function userScopedWrites(table: string, dirs: string[] = ["src"]): UserScopedWrite[] {
  const out: UserScopedWrite[] = [];
  const CALL = new RegExp(
    `([\\w.]+)\\s*\\n?\\s*\\.from\\("${table}"\\)\\s*\\n?\\s*\\.(?:update|upsert)\\(\\s*([\\s\\S]*?)\\)`,
    "g",
  );

  const seen = new Set<string>();
  for (const dir of dirs) {
    for (const file of sourceFiles(dir)) {
      if (seen.has(file)) continue;
      seen.add(file);
      const body = readFileSync(file, "utf8");
      if (!body.includes(`"${table}"`)) continue;

      for (const m of body.matchAll(CALL)) {
        const receiver = m[1];
        const before = body.slice(0, m.index);

        // service_role bypasses grants — resolve, never trust the name.
        const binding = receiver === "context.supabase" ? "context.supabase" : nearestBinding(before, receiver);
        const userScoped =
          receiver === "context.supabase" ||
          (binding !== undefined && /=\s*context\b|context\.supabase/.test(binding));
        if (!userScoped) continue;

        // Literal patch, or an identifier resolved to its declaration.
        const arg = m[2].trim();
        let columns: string[] = [];
        let unresolved = false;
        if (arg.startsWith("{")) {
          columns = columnsOf(arg);
        } else {
          const ident = arg.split(/[,)\s]/)[0];
          if (/^\w+$/.test(ident)) {
            // EVERY assignment to the identifier, not just its declaration: a
            // patch is often a `let` reassigned once per switch branch, and any
            // branch may run. The union of the branches is what the grant has
            // to cover, so a single-declaration lookup both misses columns and
            // reports a safe write as unreadable.
            const assignments = [
              ...before.matchAll(
                new RegExp(`(?:\\b(?:const|let|var)\\s+)?\\b${ident}\\s*=\\s*(\\{[\\s\\S]*?\\n\\s*\\})\\s*;`, "g"),
              ),
            ];
            if (assignments.length > 0) {
              columns = [...new Set(assignments.flatMap((a) => columnsOf(a[1])))];
            } else {
              unresolved = true;
            }
          } else {
            unresolved = true;
          }
        }

        out.push({
          file: rel(file),
          line: before.split("\n").length,
          receiver,
          columns,
          unresolved,
        });
      }
    }
  }
  return out;
}
