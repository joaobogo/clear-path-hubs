import {
  cleanupCandidateArtifacts,
  cleanupFixtures,
  cleanupIntakeArtifacts,
  qaSeed,
} from "./helpers/qa";

/** Removes every row this suite created — fixtures and UI-created artifacts. */
export default async function globalTeardown() {
  const intake = await cleanupIntakeArtifacts();
  const candidates = await cleanupCandidateArtifacts();
  // Candidate rows reference fixture positions, so they must go first.
  const fixtures = await cleanupFixtures();
  // eslint-disable-next-line no-console
  console.log("[e2e] cleanup", JSON.stringify({ intake, candidates, fixtures }));
}
