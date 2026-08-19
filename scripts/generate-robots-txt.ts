import { writeFileSync } from "node:fs";
import { buildRobotsTxt } from "@/lib/seo/robots-config";

const out = buildRobotsTxt();
writeFileSync("public/robots.txt", out);
console.log("public/robots.txt generated");
