import type { ReactNode } from "react";
import { QueryClientProvider, dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { isRedirect, type AnyRouter } from "@tanstack/react-router";

/**
 * Query-client integration for the router, kept in the repo.
 *
 * `@tanstack/react-router-with-query` stopped at 1.130 and calls
 * `router.serverSsr.isDehydrated()` and `onRenderFinished()`, which the pinned
 * router (1.170) no longer has: every route with a query loader (/jobs,
 * /status) failed to render on the server with "isDehydrated is not a
 * function". This keeps what matters from that package: the query client in
 * the route context, the provider around the app, the query cache dehydrated
 * with the router on the server and hydrated on the client, and redirects
 * thrown from queries or mutations handled by the router. Queries started
 * during render are no longer streamed; loaders ensure their data first.
 */
type Dehydrated = { dehydratedQueryClient?: ReturnType<typeof dehydrate> };

export function routerWithQueryClient<TRouter extends AnyRouter>(router: TRouter, queryClient: QueryClient): TRouter {
  const ogOptions = router.options;
  router.options = {
    ...router.options,
    context: {
      ...ogOptions.context,
      queryClient,
    },
    Wrap: ({ children }: { children: ReactNode }) => {
      // Only wrap again when the app supplied a wrapper: a Fragment written
      // as JSX would receive the dev source plugin's data attribute and warn.
      const OGWrap = ogOptions.Wrap;
      return (
        <QueryClientProvider client={queryClient}>
          {OGWrap ? <OGWrap>{children}</OGWrap> : children}
        </QueryClientProvider>
      );
    },
  };

  if (router.isServer) {
    const ogClientOptions = queryClient.getDefaultOptions();
    queryClient.setDefaultOptions({
      ...ogClientOptions,
      dehydrate: {
        shouldDehydrateQuery: () => true,
        ...ogClientOptions.dehydrate,
      },
    });
    router.options.dehydrate = async () => {
      const ogDehydrated = await ogOptions.dehydrate?.();
      return { ...ogDehydrated, dehydratedQueryClient: dehydrate(queryClient) };
    };
  } else {
    router.options.hydrate = async (dehydrated: Dehydrated) => {
      await ogOptions.hydrate?.(dehydrated);
      if (dehydrated?.dehydratedQueryClient) hydrate(queryClient, dehydrated.dehydratedQueryClient);
    };

    const toRouter = (error: unknown) => {
      if (isRedirect(error)) {
        error.options._fromLocation = router.state.location;
        return router.navigate(router.resolveRedirect(error).options);
      }
      return undefined;
    };
    // Forward whatever arguments this react-query version passes, untouched.
    const ogMutationCacheConfig = queryClient.getMutationCache().config;
    queryClient.getMutationCache().config = {
      ...ogMutationCacheConfig,
      onError: (...args) => toRouter(args[0]) ?? ogMutationCacheConfig.onError?.(...args),
    };
    const ogQueryCacheConfig = queryClient.getQueryCache().config;
    queryClient.getQueryCache().config = {
      ...ogQueryCacheConfig,
      onError: (...args) => toRouter(args[0]) ?? ogQueryCacheConfig.onError?.(...args),
    };
  }

  return router;
}
