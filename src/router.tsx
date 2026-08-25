import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { routeTree } from "./routeTree.gen";
import { GlobalRouteError } from "./components/global-error";
import { PublicNotFound } from "./components/marketing/site-shell";
import { RoutePendingSkeleton } from "./components/workspace/route-pending";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Retry transient failures once; 4xx should not spin.
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        staleTime: 30_000,
        // Clicking back into the workspace must never refetch every mounted
        // query at once: the resulting render swapped the element under the
        // cursor between mousedown and mouseup, so the first click was lost.
        // Panels that genuinely need focus revalidation opt in locally.
        refetchOnWindowFocus: false,
        // Keep the previous result on screen while a new key loads, so a
        // search field or filter never unmounts mid-keystroke.
        placeholderData: <T,>(prev: T) => prev,

      },
      mutations: {
        // Mutations never silently retry — surface the failure so the UI can rollback.
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: GlobalRouteError,
    // Stale content from the previous route must never render under a new URL:
    // show the destination's skeleton the instant navigation starts.
    defaultPendingComponent: RoutePendingSkeleton,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    // Any route without its own 404 surface still gets a designed page.
    defaultNotFoundComponent: PublicNotFound,
  });

  return routerWithQueryClient(router, queryClient);
};
