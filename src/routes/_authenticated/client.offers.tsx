import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Offers are made directly between the client and the candidate, outside
 * TaaSFlow. The Offers board is gone; the stage is tracked on the candidates
 * board. Old bookmarks and notification links land there.
 */
export const Route = createFileRoute("/_authenticated/client/offers")({
  validateSearch: (search: Record<string, unknown>) => ({
    org: typeof search.org === "string" ? search.org : undefined,
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/client/candidates",
      search: { view: "board", org: search.org },
      replace: true,
    });
  },
});
