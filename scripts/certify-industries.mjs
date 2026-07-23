// Static QA certification for industry entries — no Vite/import.meta needed.
// Validates every required content field is present per Prompt 40.
import { INDUSTRY_ENTRIES } from "../src/content/industries-v2.ts";

const missingFor = (e) => {
  const m = [];
  if (!e.hero?.title) m.push("hero.title");
  if (!e.hero?.subtitle) m.push("hero.subtitle");
  if (!e.summary && !e.meta?.description) m.push("summary");
  if (!e.meta?.title) m.push("meta.title");
  if (!e.meta?.description) m.push("meta.description");
  if (!e.cta?.title) m.push("cta.title");
  if (!e.cta?.description) m.push("cta.description");
  if (!(e.roleFamilies?.length || e.roles?.length)) m.push("roles/roleFamilies");
  if (!e.candidateSignals?.length) m.push("candidateSignals");
  if (!e.challenges?.length) m.push("challenges");
  if (!e.signals?.length) m.push("signals");
  return m;
};

const slugCounts = new Map();
for (const e of INDUSTRY_ENTRIES) slugCounts.set(e.slug, (slugCounts.get(e.slug) ?? 0) + 1);

// Uniqueness checks per Prompt 40.
const titles = new Map();
const summaries = new Map();
for (const e of INDUSTRY_ENTRIES) {
  titles.set(e.hero?.title, (titles.get(e.hero?.title) ?? 0) + 1);
  summaries.set(e.summary || e.meta?.description, (summaries.get(e.summary || e.meta?.description) ?? 0) + 1);
}

const failed = [];
for (const e of INDUSTRY_ENTRIES) {
  const m = missingFor(e);
  if (slugCounts.get(e.slug) > 1) m.push("duplicate slug");
  if ((titles.get(e.hero?.title) ?? 0) > 1) m.push("duplicate hero.title");
  if ((summaries.get(e.summary || e.meta?.description) ?? 0) > 1) m.push("duplicate summary");
  if (m.length) failed.push({ slug: e.slug, missing: m });
}

console.log(`Total industries: ${INDUSTRY_ENTRIES.length}`);
console.log(`Passed: ${INDUSTRY_ENTRIES.length - failed.length}`);
console.log(`Failed: ${failed.length}`);
for (const f of failed) console.log("FAIL", f.slug, "-", f.missing.join(", "));
process.exit(failed.length ? 1 : 0);
