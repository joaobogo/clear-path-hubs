/**
 * A read-only Supabase-shaped client backed by `psql`.
 *
 * The parity suite has to call the real readers in `src/lib/kpis/`, not a copy
 * of their logic — a copy would drift exactly like the numbers they replaced.
 * The readers only ever take a client and call `.from().select()...`, so this
 * stub answers those calls with plain SQL against the project database.
 *
 * It reports "not a member" for every membership probe, which keeps
 * `readOrgRows` on the passed client instead of importing the service client
 * (unavailable in a test process). Only SELECT is ever issued.
 */
import { execFileSync } from "node:child_process";

export function hasDatabaseAccess(): boolean {
  return Boolean(process.env["PGHOST"]);
}

export function sqlJson<T = Record<string, unknown>>(sql: string): T[] {
  const wrapped = `select coalesce(json_agg(t), '[]'::json)::text from (${sql}) t`;
  const out = execFileSync("psql", ["-A", "-t", "-X", "-q", "-c", wrapped], {
    encoding: "utf8",
  });
  return JSON.parse(out.trim() || "[]") as T[];
}

export function sqlCount(sql: string): number {
  const rows = sqlJson<{ n: number | string }>(sql);
  return Number(rows[0]?.n ?? 0);
}

function lit(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

const OPS: Record<string, string> = {
  eq: "=",
  gte: ">=",
  lte: "<=",
  gt: ">",
  lt: "<",
  neq: "<>",
};

/** `col.op.value` as used inside a PostgREST `or(...)` filter. */
function condition(fragment: string): string {
  const [col, op, ...rest] = fragment.split(".");
  const value = rest.join(".");
  if (op === "is") return `${col} is ${value === "null" ? "null" : lit(value)}`;
  const sqlOp = OPS[String(op)];
  if (!sqlOp) throw new Error(`unsupported filter op: ${fragment}`);
  return `${col} ${sqlOp} ${lit(value)}`;
}

/** Splits `and(a,b),and(c,d)` on top-level commas. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

function orClause(expr: string): string {
  const groups = splitTopLevel(expr).map((group) => {
    const inner = group.match(/^and\((.*)\)$/);
    if (inner) {
      return `(${splitTopLevel(inner[1]!).map(condition).join(" and ")})`;
    }
    return `(${condition(group)})`;
  });
  return `(${groups.join(" or ")})`;
}

/** Drops embedded relations such as `positions(title)` from a select list. */
function columnList(select: string): string {
  const cols = splitTopLevel(select)
    .map((c) => c.trim())
    .filter((c) => c && !c.includes("("));
  return cols.length ? cols.join(", ") : "*";
}

class Builder implements PromiseLike<{ data: unknown; error: null }> {
  private wheres: string[] = [];
  private orderBy: string | null = null;
  private limitTo: number | null = null;
  private single = false;

  constructor(
    private table: string,
    private select: string,
  ) {}

  eq(col: string, value: unknown) {
    this.wheres.push(`${col} = ${lit(value)}`);
    return this;
  }
  neq(col: string, value: unknown) {
    this.wheres.push(`${col} <> ${lit(value)}`);
    return this;
  }
  gte(col: string, value: unknown) {
    this.wheres.push(`${col} >= ${lit(value)}`);
    return this;
  }
  lte(col: string, value: unknown) {
    this.wheres.push(`${col} <= ${lit(value)}`);
    return this;
  }
  in(col: string, values: readonly unknown[]) {
    const list = values.length ? values.map(lit).join(", ") : "null";
    this.wheres.push(`${col} in (${list})`);
    return this;
  }
  is(col: string, value: unknown) {
    this.wheres.push(`${col} is ${value === null ? "null" : lit(value)}`);
    return this;
  }
  not(col: string, op: string, value: unknown) {
    this.wheres.push(`not (${condition(`${col}.${op}.${String(value)}`)})`);
    return this;
  }
  or(expr: string) {
    this.wheres.push(orClause(expr));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy = `${col} ${opts?.ascending === false ? "desc" : "asc"} nulls last`;
    return this;
  }
  limit(n: number) {
    this.limitTo = n;
    return this;
  }
  maybeSingle() {
    this.single = true;
    this.limitTo = 1;
    return this;
  }

  private run(): { data: unknown; error: null } {
    const where = this.wheres.length ? ` where ${this.wheres.join(" and ")}` : "";
    const order = this.orderBy ? ` order by ${this.orderBy}` : "";
    const limit = this.limitTo === null ? "" : ` limit ${this.limitTo}`;
    const rows = sqlJson(
      `select ${columnList(this.select)} from public.${this.table}${where}${order}${limit}`,
    );
    return { data: this.single ? (rows[0] ?? null) : rows, error: null };
  }

  then<R1 = { data: unknown; error: null }, R2 = never>(
    onfulfilled?: ((v: { data: unknown; error: null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }
}

export function createPsqlSupabase() {
  return {
    from(table: string) {
      return {
        select(select = "*") {
          // Membership probes must report "not a member" so the readers stay on
          // this client rather than reaching for the service-role client.
          if (table === "memberships" && select === "organization_id") {
            return new Builder("memberships", select).eq("id", "00000000-0000-0000-0000-000000000000");
          }
          return new Builder(table, select);
        },
      };
    },
  };
}
