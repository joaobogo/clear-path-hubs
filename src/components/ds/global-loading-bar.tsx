import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useEffect, useState } from "react";

/**
 * A thin bar across the top of the app whenever anything is in flight.
 *
 * Every dashboard had its own answer to "are we loading?", and each covered the
 * queries its author happened to list: the admin work queues skeleton keys off
 * `isPending`, which is true on the FIRST load only, and the client overview
 * spins an icon inside its refresh button for four named queries. So a screen
 * quietly refetching showed stale numbers with no sign it was working, and a
 * page whose author forgot the wiring showed nothing at all.
 *
 * `useIsFetching` counts every query in flight, so this cannot be forgotten by
 * a new screen and cannot fall out of step with one that adds a query. It sits
 * alongside the per-panel skeletons rather than replacing them: a skeleton says
 * "this section has no data yet", this says "the page is talking to the
 * server". Both are true at once on a first load, and only this one is true
 * during a refresh.
 *
 * Mutations count too — saving is also a moment where a user needs to know
 * something is happening.
 */
export function GlobalLoadingBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const busy = fetching + mutating > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    // A short delay so a fast query does not flash a bar on every keystroke or
    // cache hit. Anything under this is quick enough that the result IS the
    // feedback.
    const t = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(t);
  }, [busy]);

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full w-full overflow-hidden bg-primary/15">
        <div className="h-full w-1/3 animate-[loading-slide_1.1s_ease-in-out_infinite] bg-primary" />
      </div>
      {/* Announced politely: a screen reader should hear that the page is
          working, once, not on every frame of the animation. */}
      <span className="sr-only" role="status" aria-live="polite">
        {visible ? "Loading" : ""}
      </span>
    </div>
  );
}
