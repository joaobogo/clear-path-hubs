/**
 * Every server function on an admin/staff surface must assert staff identity
 * inside its own handler. A route guard only protects the UI — the RPC endpoint
 * stays directly callable, so the handler is the security boundary.
 *
 * This test reads the source of each admin-surface `*.functions.ts` file and
 * fails if an exported server function has no recognised guard. Add a guard,
 * don't extend the allowlist, unless the function is genuinely non-staff.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "src/lib");

/** Any call that resolves staff identity server-side before doing work. */
const GUARD = new RegExp(
  [
    "requireStaff",
    "requirePlatformAdmin",
    "requireOperator",
    "requireOperatorAdmin",
    "requireCopilotStaff",
    "requireScoringStaff",
    "assertPlatformStaff",
    "assertPlatformAdmin",
    "staffAdmin\\(",
    "assertStaff\\(",
    "is_platform_staff",
    "is_platform_admin",
  ].join("|"),
);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.functions\.tsx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

/**
 * Exceptions, each justified. These are not staff-only data reads: the row set
 * is scoped to the caller by RLS (author or recipient), so a client or
 * candidate calling them can only ever touch their own rows.
 */
const SELF_SCOPED_BY_RLS = new Set([
  // internal_notes DELETE policy: is_platform_staff() AND author_user_id = auth.uid()
  "src/lib/admin-workbench.functions.ts :: deleteInternalNote",
  // notifications UPDATE is filtered to recipient_user_id = caller
  "src/lib/admin-workbench.functions.ts :: resolveNotification",
]);

/** Files whose surface is the staff/admin console. */
const ADMIN_SURFACE = /(admin|agent-ops|wbr)/i;

function unguardedExports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const bad: string[] = [];
  const chunks = src.split(/\nexport const /).slice(1);
  for (const chunk of chunks) {
    if (!chunk.includes("createServerFn")) continue;
    const name = chunk.split(/[\s=]/)[0] ?? "?";
    if (!GUARD.test(chunk)) bad.push(name);
  }
  return bad;
}

describe("admin surface authorization coverage", () => {
  const files = walk(ROOT).filter((f) => ADMIN_SURFACE.test(f));

  it("finds the admin server-function modules", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("guards every exported admin server function server-side", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const name of unguardedExports(file)) {
        const id = `${file.replace(process.cwd() + "/", "")} :: ${name}`;
        if (SELF_SCOPED_BY_RLS.has(id)) continue;
        offenders.push(id);
      }
    }
    expect(offenders).toEqual([]);
  });
});
