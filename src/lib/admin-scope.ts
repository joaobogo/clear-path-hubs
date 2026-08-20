/**
 * Backward-compatible re-exports for the admin test scope.
 *
 * The canonical implementation now lives in the React provider at
 * `src/components/admin/admin-test-scope.tsx` so the scope can be fetched
 * asynchronously without blocking the admin layout `beforeLoad`.
 */
export {
  AdminTestScopeProvider,
  useAdminTestScope,
  useIncludeTestRecords,
  useScopedIncludeTest,
  type AdminTestScope,
} from "@/components/admin/admin-test-scope";
