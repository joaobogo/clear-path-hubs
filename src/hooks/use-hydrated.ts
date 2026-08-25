import { useEffect, useState } from "react";

/**
 * True once the component has mounted on the client and its event handlers are
 * live. Controls that render before hydration would otherwise swallow the very
 * first click, so they render disabled until this flips.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
