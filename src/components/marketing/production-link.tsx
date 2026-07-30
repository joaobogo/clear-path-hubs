import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { isCanonicalHost, canonicalUrl } from "@/lib/canonical-origin";

/**
 * A link that must always land on the real TaaSFlow domain.
 *
 * Renders a normal client-side <Link> (so SSR markup and hydration match).
 * When the page is being served from the preview host, the click is
 * intercepted and sent to the production URL instead.
 */
export function ProductionLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={className}
      onClick={(event) => {
        if (typeof window === "undefined") return;
        if (isCanonicalHost(window.location.hostname)) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        window.location.assign(canonicalUrl(to));
      }}
    >
      {children}
    </Link>
  );
}
