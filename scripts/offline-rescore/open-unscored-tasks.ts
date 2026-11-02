/**
 * Writes open-unscored-tasks.sql next to this file: one idempotent operator
 * statement that opens the admin task for every unscored match that has no
 * open candidate_review task. Usage:
 *   npx tsx scripts/offline-rescore/open-unscored-tasks.ts
 * It does not touch the database; an operator reviews and applies the file.
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { unscoredTaskBackfillSql } from "../../src/lib/cv/unscored-backfill";

writeFileSync(
  fileURLToPath(new URL("./open-unscored-tasks.sql", import.meta.url)),
  unscoredTaskBackfillSql(),
);
