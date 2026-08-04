import { cleanupIntakeArtifacts, seedFixtures } from "./helpers/qa";

/** Seeds the QA tenant once for the whole run. */
export default async function globalSetup() {
  // Start from a clean slate for anything a previous run left behind.
  await cleanupIntakeArtifacts();
  const seeded = await seedFixtures();
  process.env["E2E_SEED"] = JSON.stringify({
    org_id: seeded.org_id,
    position_id: seeded.position_id,
    closed_position_id: seeded.closed_position_id,
    users: seeded.users,
  });
  // eslint-disable-next-line no-console
  console.log(`[e2e] seeded org ${seeded.org_id}, position ${seeded.position_id}`);
}
