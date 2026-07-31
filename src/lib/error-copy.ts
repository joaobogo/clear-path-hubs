/**
 * Plain-language, audience-aware error copy.
 *
 * No user should ever see a raw exception message, a Postgres error code, or an
 * HTTP status. Every failure is translated into: what happened, and what to do
 * next — phrased for whoever is looking at the screen (platform staff, a client
 * user, a candidate, or an anonymous visitor).
 */

export type ErrorAudience = "admin" | "client" | "candidate" | "public";

export type ErrorCopy = {
  title: string;
  body: string;
  nextStep: string;
  canRetry: boolean;
  homeHref: string;
  homeLabel: string;
  reference?: string;
};

export type ErrorKind =
  | "permission"
  | "not_found"
  | "network"
  | "payment"
  | "validation"
  | "conflict"
  | "unknown";

export function audienceForPath(pathname: string): ErrorAudience {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/client")) return "client";
  if (
    pathname.startsWith("/jobs") ||
    pathname.startsWith("/apply") ||
    pathname.startsWith("/candidate")
  ) {
    return "candidate";
  }
  return "public";
}

const HOME: Record<ErrorAudience, { href: string; label: string }> = {
  admin: { href: "/admin", label: "Back to the work queue" },
  client: { href: "/client", label: "Back to your dashboard" },
  candidate: { href: "/jobs", label: "Back to open roles" },
  public: { href: "/", label: "Back to the homepage" },
};

export function classifyError(error: unknown): ErrorKind {
  const raw = (
    error instanceof Error ? error.message : String(error ?? "")
  ).toLowerCase();

  if (!raw) return "unknown";
  if (
    raw.includes("permission") ||
    raw.includes("forbidden") ||
    raw.includes("unauthorized") ||
    raw.includes("not allowed") ||
    raw.includes("row-level security") ||
    raw.includes("row level security") ||
    raw.includes("401") ||
    raw.includes("403")
  ) {
    return "permission";
  }
  if (raw.includes("not found") || raw.includes("404") || raw.includes("no rows")) {
    return "not_found";
  }
  if (
    raw.includes("payment") ||
    raw.includes("checkout") ||
    raw.includes("stripe")
  ) {
    return "payment";
  }
  if (
    raw.includes("failed to fetch") ||
    raw.includes("network") ||
    raw.includes("timeout") ||
    raw.includes("aborted") ||
    raw.includes("load failed")
  ) {
    return "network";
  }
  if (
    raw.includes("invalid") ||
    raw.includes("required") ||
    raw.includes("must be") ||
    raw.includes("validation")
  ) {
    return "validation";
  }
  if (
    raw.includes("conflict") ||
    raw.includes("duplicate") ||
    raw.includes("already exists") ||
    raw.includes("transition")
  ) {
    return "conflict";
  }
  return "unknown";
}

const MESSAGES: Record<
  ErrorKind,
  Record<ErrorAudience, { title: string; body: string; nextStep: string }>
> = {
  permission: {
    admin: {
      title: "You don't have access to this",
      body: "Your staff account doesn't include this area.",
      nextStep: "Ask a platform admin to grant access, or head back to the queue.",
    },
    client: {
      title: "This isn't part of your access",
      body: "Your seat doesn't include this page or record.",
      nextStep: "Ask an admin on your team to change your access level.",
    },
    candidate: {
      title: "We can't open this for you",
      body: "That link is either private or no longer valid for your application.",
      nextStep: "Use your reference number and email on the status page instead.",
    },
    public: {
      title: "This page is private",
      body: "You need to be signed in with the right access to see it.",
      nextStep: "Sign in, or return to the homepage.",
    },
  },
  not_found: {
    admin: {
      title: "That record no longer exists",
      body: "It may have been deleted or merged.",
      nextStep: "Search for it from the work queue.",
    },
    client: {
      title: "We couldn't find that",
      body: "The role or candidate you opened isn't available any more.",
      nextStep: "Go back to your dashboard and open it from the list.",
    },
    candidate: {
      title: "This role isn't available",
      body: "It may have closed since you last opened the link.",
      nextStep: "Browse the roles that are still open.",
    },
    public: {
      title: "Page not found",
      body: "The link may be out of date.",
      nextStep: "Head back to the homepage.",
    },
  },
  network: {
    admin: {
      title: "We couldn't reach the server",
      body: "The request didn't complete. Nothing was saved.",
      nextStep: "Check your connection and try again.",
    },
    client: {
      title: "Connection interrupted",
      body: "We couldn't load your workspace just now. Nothing was changed.",
      nextStep: "Try again in a moment.",
    },
    candidate: {
      title: "Connection interrupted",
      body: "Your application wasn't affected — this was only a loading problem.",
      nextStep: "Try again in a moment.",
    },
    public: {
      title: "Connection interrupted",
      body: "We couldn't load this page.",
      nextStep: "Try again in a moment.",
    },
  },
  payment: {
    admin: {
      title: "Payment step didn't complete",
      body: "The billing service didn't return a result for this role.",
      nextStep: "Check the payments ledger before retrying.",
    },
    client: {
      title: "We couldn't complete the payment step",
      body: "You have not been charged twice — no role was published.",
      nextStep: "Try the checkout again, or contact us and we'll finish it for you.",
    },
    candidate: {
      title: "Something went wrong",
      body: "This part of the site isn't available right now.",
      nextStep: "Try again shortly.",
    },
    public: {
      title: "We couldn't complete the payment step",
      body: "No charge was taken.",
      nextStep: "Try again, or contact us and we'll help.",
    },
  },
  validation: {
    admin: {
      title: "Some details weren't accepted",
      body: "One or more fields didn't meet the required shape, so nothing was saved.",
      nextStep: "Review the highlighted fields and save again.",
    },
    client: {
      title: "Some details need a change",
      body: "We couldn't save this because part of the form isn't complete.",
      nextStep: "Check the fields marked in red and try again.",
    },
    candidate: {
      title: "Check your details",
      body: "Something in the form wasn't accepted, so nothing was submitted.",
      nextStep: "Review your answers and your CV file, then submit again.",
    },
    public: {
      title: "Check your details",
      body: "Part of the form wasn't accepted.",
      nextStep: "Review your answers and try again.",
    },
  },
  conflict: {
    admin: {
      title: "This change clashed with another update",
      body: "The record moved on before your change was applied, so it was rejected.",
      nextStep: "Reload the record and repeat the action.",
    },
    client: {
      title: "Someone else changed this first",
      body: "Your update wasn't applied because the record already moved on.",
      nextStep: "Refresh the page and make the change again.",
    },
    candidate: {
      title: "This has already been updated",
      body: "Your earlier change is already saved.",
      nextStep: "Refresh to see the latest version.",
    },
    public: {
      title: "This has already been updated",
      body: "No further change was needed.",
      nextStep: "Refresh the page.",
    },
  },
  unknown: {
    admin: {
      title: "Something went wrong",
      body: "An unexpected error stopped this page loading. It has been logged.",
      nextStep: "Try again — if it repeats, check the operational health page.",
    },
    client: {
      title: "Something went wrong",
      body: "We hit an unexpected problem loading this page. Your data is safe.",
      nextStep: "Try again — if it keeps happening, message us and we'll look into it.",
    },
    candidate: {
      title: "Something went wrong",
      body: "We hit an unexpected problem. Your application hasn't been affected.",
      nextStep: "Try again in a moment.",
    },
    public: {
      title: "Something went wrong",
      body: "We hit an unexpected error loading this page.",
      nextStep: "Try again, or head back to the homepage.",
    },
  },
};

export function describeError(
  error: unknown,
  pathname: string,
  reference?: string,
): ErrorCopy {
  const audience = audienceForPath(pathname);
  const kind = classifyError(error);
  const base = MESSAGES[kind][audience];
  const home = HOME[audience];

  return {
    ...base,
    canRetry: kind !== "permission",
    homeHref: home.href,
    homeLabel: home.label,
    reference,
  };
}

/**
 * Short, single-line version for toasts and inline form errors.
 */
export function errorMessage(error: unknown, pathname = "/"): string {
  const copy = describeError(error, pathname);
  return `${copy.body} ${copy.nextStep}`;
}
