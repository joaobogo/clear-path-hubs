/**
 * Client-facing surfaces never show QA fixtures.
 *
 * Positions and candidate matches created by automated tests carry
 * `is_test_record = true`. Admin screens can opt into them through the
 * "Show test records" toggle; the client workspace has no such concept, so
 * every client read filters them out unconditionally.
 *
 * `is_test_record` is nullable on some older rows, so "not a test record"
 * has to accept NULL as well as false — otherwise real rows disappear.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

export function excludeTestRecords<T>(query: T): T {
  return (query as AnyQuery).or("is_test_record.is.null,is_test_record.eq.false") as T;
}

/**
 * Second line of defence: some older fixtures were written before the flag
 * existed, so they read as real rows. Their titles carry the QA marker, and a
 * client should never see one — a role called "[QA test — ignore] Cert Role"
 * in the workspace reads as a broken product.
 */
const QA_TITLE_MARKERS = [
  "qa test",
  "qa gate",
  "browser-test",
  "browser test",
  "smoke test",
  "e2e test",
  "test record",
  "ignore]",
];

export function isQaFixtureTitle(title: unknown): boolean {
  if (typeof title !== "string") return false;
  const t = title.toLowerCase();
  return QA_TITLE_MARKERS.some((marker) => t.includes(marker));
}
