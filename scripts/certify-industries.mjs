import { INDUSTRY_ENTRIES } from "../src/content/industries-v2.ts";
import { certifyIndustryBundle } from "../src/lib/marketing/industry-relationships.ts";
const results = INDUSTRY_ENTRIES.map(certifyIndustryBundle);
const failed = results.filter((r) => !r.passes);
console.log(`Certified ${results.length - failed.length}/${results.length} industries`);
for (const f of failed) console.log("FAIL", f.slug, "-", f.missing.join(", "));
process.exit(failed.length ? 1 : 0);
