# Daily BabyLoveGrowth drafts with human publishing

## What you get
- Once a day the backend pulls new BabyLoveGrowth articles and saves them as **drafts awaiting review**. Nothing goes live on its own.
- A new admin page, **Blog drafts**, lists each draft (title, short preview, keywords) with **Publish** and **Reject**, and a "N drafts waiting" count (also shown as a badge on the admin home).
- Published drafts appear on /blog, /blog/<slug>, category pages and the blog sitemap, looking exactly like today's posts. The 362 existing posts, their URLs, redirects and noindex rules stay as they are.

## How it fits today's blog
Posts currently come from `src/content/blog/*.json` through `blog` (content.ts) → `listAllBlogRows()` (blog-catalog.ts) → blog pages and `buildChildSitemapXml("blog")`. All of this is synchronous and built at bundle time; `ARCHIVE_PAGES` is a constant. The change adds a second source that is loaded on the server and merged into the same rows. JSON posts keep priority: a database post whose slug matches a JSON post or redirect is blocked when publishing.

## Files

New
- `drizzle/migrations/0005_blog_drafts.sql` — the table (see below).
- `src/lib/blog/babylovegrowth.server.ts` — API client (list + detail, `X-API-Key`), maps an article to the post shape (meta title/description/og, markdown, keywords → tags, category, published time), sanitises slugs.
- `src/lib/blog/db-posts.server.ts` — reads published rows with a publishable-key client (anon SELECT limited to `status='published'`) and converts them to the same entry/`BlogRow` shape as the JSON posts.
- `src/lib/blog/blog-source.functions.ts` — public server functions `listMergedBlogRows()` and `getMergedBlogPost(slug)`: JSON first, then published DB posts, sorted as today.
- `src/lib/blog/blog-drafts.functions.ts` — staff-only (`requireSupabaseAuth` + platform_admin/operations check) `listBlogDrafts`, `countPendingBlogDrafts`, `publishBlogDraft`, `rejectBlogDraft`; each records an audit event.
- `src/routes/api/public/hooks/babylovegrowth-sync.ts` — daily job endpoint. Requires a server-only `BLOG_SYNC_TOKEN` bearer (not the publishable key, since it writes), fetches new article ids, inserts only unseen `external_id`s as `pending`. Idempotent; never publishes.
- `src/routes/_authenticated/admin.blog-drafts.tsx` — the review page.
- `src/lib/blog/__tests__/db-posts.test.ts` — tests: a pending/rejected draft never appears in rows or sitemap; published appears; JSON slug wins on collision; redirect slugs are rejected; sync does not insert a duplicate `external_id`.

Edited
- `src/lib/marketing/blog-catalog.ts` — add `mergeBlogRows(staticRows, dbRows)`; keep `listAllBlogRows()` unchanged for current callers/tests.
- `src/routes/blog.index.tsx` — the loader awaits `listMergedBlogRows()`; page count is calculated from the merged total instead of the `ARCHIVE_PAGES` constant (redirect rules unchanged).
- `src/routes/blog.$slug.tsx` — the loader falls back to `getMergedBlogPost` when no JSON post exists; same head/JSON-LD/canonical/author code path.
- `src/routes/blog.category.$slug.tsx` — uses the merged rows.
- `src/lib/seo/index-config.ts` + `src/routes/sitemap-blog[.]xml.ts` — the blog child sitemap includes published DB slugs (lastmod = published_at).
- `src/routes/_authenticated/admin.index.tsx` and admin nav config — "Blog drafts" link with pending count.
- `AGENTS.md` — one rule: external blog articles enter as drafts and only reach public pages after a staff publish.

## Migration (additive)
`public.blog_drafts`: `id uuid pk`, `external_id text unique not null`, `slug text unique not null`, `title`, `description`, `markdown`, `keywords text[]`, `category`, `hero_image`, `meta jsonb`, `status text default 'pending'` (pending|published|rejected, validated by trigger), `fetched_at`, `reviewed_by uuid`, `reviewed_at`, `published_at`.
Grants: `SELECT` to anon + authenticated, `ALL` to service_role. RLS: anon/authenticated may SELECT only `status='published'`; staff (via existing `has_role`) may SELECT/UPDATE everything. Inserts only via service role in the sync endpoint. Rollback: drop the table (no existing data touched).

## Schedule setup
Enable `pg_cron` + `pg_net`, then (run once, outside migrations) schedule `babylovegrowth-daily` at `0 6 * * *` UTC calling `POST https://taasflow.com/api/public/hooks/babylovegrowth-sync` with body `{}` and `Authorization: Bearer <BLOG_SYNC_TOKEN>`; the token is kept in the database vault, not inline.

## Secrets
- `BABYLOVEGROWTH_API_KEY` — **you add this** in Project Settings → Secrets.
- `BLOG_SYNC_TOKEN` — I generate it automatically; you don't need to do anything.

## Verification
Existing tests (blog-noindex, blog-pagination, sitemap-robots, blog-redirects) plus the new ones; one manual sync against the real API, publish one draft, confirm SSR HTML, meta tags, JSON-LD and the sitemap entry, then reject a draft and confirm it stays hidden.

## Assumptions
- The API returns markdown (or HTML that we convert) plus title/description/keywords; the exact field mapping is confirmed on the first real call.
- Author defaults to "TaaSFlow Editorial Team" and category to "General" unless the article provides one.
