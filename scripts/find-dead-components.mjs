/**
 * Components nothing renders.
 *
 * Two fully-built features have already turned up this way — the
 * previously-considered panel and the resurface panel, both with logic, tests
 * and UI, and no route that mounts them. Dead UI costs review time (an audit
 * investigates code no user can reach) and eventually misleads someone into
 * treating it as live.
 *
 * Usage: node scripts/find-dead-components.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const all = walk("src");
const bodies = new Map(all.map((f) => [f, readFileSync(f, "utf8")]));

const dead = [];
for (const file of walk(join("src", "components"))) {
  const src = bodies.get(file);
  const names = [...src.matchAll(/export (?:function|const) ([A-Z]\w+)/g)].map((m) => m[1]);
  if (names.length === 0) continue;

  const referenced = names.some((name) => {
    const re = new RegExp(`\\b${name}\\b`);
    for (const [other, body] of bodies) {
      if (other === file) continue;
      if (re.test(body)) return true;
    }
    return false;
  });

  if (!referenced) dead.push({ file: file.replaceAll("\\", "/"), names });
}

console.log(`${dead.length} component file(s) nothing references\n`);
for (const d of dead) console.log(`${d.file}\n    exports: ${d.names.join(", ")}`);
