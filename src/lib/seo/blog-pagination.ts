/**
 * Blog archive pagination: one stable, ordered dataset.
 *
 * Rules (also enforced by tests):
 *  - Rows arrive newest first. When nobody is searching or filtering, the first
 *    row is the featured post. It is shown above the list on page 1 only and is
 *    EXCLUDED from the paginated list on every page, so no post appears twice
 *    and none is skipped.
 *  - When a search or category filter is active there is no featured post and
 *    the list is the filtered rows.
 *  - `/blog` is the one address for page 1. `?page=1`, `?page=0`, `?page=abc`
 *    and fractional or negative values redirect to `/blog`; a page past the end
 *    redirects to the last page.
 */
export const BLOG_PAGE_SIZE = 24;

export type BlogPageResult<T> = {
  featured: T | null;
  items: T[];
  page: number;
  pages: number;
  /** Rows in the paginated list (featured excluded). */
  total: number;
};

export function paginateBlog<T>(
  rows: readonly T[],
  requestedPage: number,
  opts: { withFeatured: boolean; pageSize?: number },
): BlogPageResult<T> {
  const pageSize = opts.pageSize ?? BLOG_PAGE_SIZE;
  const featuredRow = opts.withFeatured && rows.length > 0 ? rows[0]! : null;
  const list = featuredRow ? rows.slice(1) : rows.slice();
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pages);
  return {
    featured: featuredRow && page === 1 ? featuredRow : null,
    items: list.slice((page - 1) * pageSize, page * pageSize),
    page,
    pages,
    total: list.length,
  };
}

/** Number of archive pages for an unfiltered archive of `rowCount` posts. */
export function blogPageCount(rowCount: number, pageSize = BLOG_PAGE_SIZE): number {
  const listLength = Math.max(0, rowCount - 1); // the featured post is not in the list
  return Math.max(1, Math.ceil(listLength / pageSize));
}

export type BlogPageResolution =
  | { kind: "ok"; page: number }
  /** `page` is the page to redirect to; 1 means `/blog` with no parameter. */
  | { kind: "redirect"; page: number };

/**
 * Turn the raw `?page=` value into a page or a redirect target.
 * `raw` is whatever the router parsed: number, string or undefined.
 */
export function resolveBlogPage(raw: unknown, pages: number): BlogPageResolution {
  if (raw === undefined || raw === null || raw === "") return { kind: "ok", page: 1 };
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1) return { kind: "redirect", page: 1 };
  if (n === 1) return { kind: "redirect", page: 1 };
  if (n > pages) return { kind: "redirect", page: pages };
  return { kind: "ok", page: n };
}

/** Site-relative address of an archive page. Page 1 has no parameter. */
export function blogPagePath(page: number): string {
  return page > 1 ? `/blog?page=${page}` : "/blog";
}

/** Head values for an archive page. Page 2+ get their own title and description. */
export function blogPageHead(page: number, pages: number) {
  const path = blogPagePath(page);
  return {
    path,
    prevPath: page > 1 ? blogPagePath(page - 1) : undefined,
    nextPath: page < pages ? blogPagePath(page + 1) : undefined,
    fallback:
      page > 1
        ? {
            title: `TaaSFlow Blog — Page ${page}`,
            description: `Page ${page} of the TaaSFlow blog: hiring guides, playbooks and market data for talent teams.`,
          }
        : undefined,
  };
}
