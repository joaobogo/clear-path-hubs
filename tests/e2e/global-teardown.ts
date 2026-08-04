import { cleanupFixtures, cleanupIntakeArtifacts, qaSeed } from "./helpers/qa";

/** Removes every row this suite created — fixtures and UI-created artifacts. */
export default async function globalTeardown() {
  const intake = await cleanupIntakeArtifacts();
  const booking = await qaSeed("cleanup_booking_e2e", {
    email_pattern: "qa.book+%@qa.taasflow.test",
  });
  const fixtures = await cleanupFixtures();
  // eslint-disable-next-line no-console
  console.log("[e2e] cleanup", JSON.stringify({ intake, booking, fixtures }));
}
