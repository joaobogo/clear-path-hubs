# 06 Release checklist

Purpose: a repeatable gate for releasing the SEO/CRO changes: what to run before deploy, what to check on production after deploy, how to roll back, and what to watch for the first 24 to 48 hours and the following weeks. It follows playbook prompt 23: work from the actual changed-file list, stop if a critical approval or privacy check is unresolved, and do not bundle unrelated work. Commands are written for a shell with `curl` and `grep`; replace `HOST` as noted. Nothing here has been run against production.

Last updated: 7 October 2026

## 0. Hard rule

**Do not enable payments.** `PAYMENTS_ENABLED` in `src/config/commerce.ts` stays `false`. No release step, flag or hotfix may flip it. `npm run check:no-card processor` guards the public surface. Enabling checkout needs a separate owner decision (see `docs/PAYMENTS_RUNBOOK.md`).

## 1. Pre-deploy checks

| # | Check | Command | Pass condition |
| --- | --- | --- | --- |
| 1 | Clean list of changes | `git status` and `git diff --stat 5a8ceb2..HEAD` | Only intended files. Uncommitted work from other agents is committed or excluded on purpose. |
| 2 | Typecheck | `npm run typecheck` | No errors |
| 3 | Unit tests | `npm run test` | Pass, except the two known failures that need Supabase env: `src/lib/__tests__/message-history-log.test.ts`, `src/lib/__tests__/messaging-history.test.ts` |
| 4 | SEO suites | `npx vitest run src/lib/seo src/content/__tests__ src/routes/__tests__` | Pass (sitemap and robots, blog noindex and pagination, edge policy, redirects, pricing claims) |
| 5 | Guards | `npm run check:vocabulary && npm run check:kpi-sync && npm run check:scaled-content && npm run check:internal-links && npm run check:structured-data` | Pass |
| 6 | Build | `npm run build` (runs the `prebuild` guards, regenerates `public/robots.txt` and `public/ai.txt`) | Succeeds |
| 7 | Release gate (optional, slower) | `npm run release:gate` | Pass; needs e2e prerequisites (Playwright, env) |
| 8 | Stale-string scan of built output | Section 1.1 | Only allow-listed hits |
| 9 | Metadata lengths | `npx vitest run src/lib/seo/__tests__/head-length-audit.test.ts` | Reviewed; see `05-metadata-and-schema-inventory.md` |
| 10 | Approvals | `08-owner-decisions-register.md` | No claim published that depends on an unresolved owner fact |
| 11 | Durable lead test | Submit the `/pilot` inquiry on staging with a test email; confirm the row in `marketing_inquiries`, the Teams and internal notification, and the entry in `/admin/lead-delivery` | Lead arrives; no real candidate data used |
| 12 | Booking test | Book a test slot on `/book` | Confirmation shown; booking record exists |
| 13 | Checkout stays disabled | Open `/checkout` and the intake end screen on staging | No payment form is offered to visitors |

### 1.1 Stale-string scan (built output)

Run after `npm run build`. The build is written to `.output/` (`.output/public` for browser assets, `.output/server` for the server bundle). Use `-F` so `$` is literal.

```sh
cd .output
for s in '$399' '$2,100' '$4,500' 'Bronze' 'Representative' 'Unknown' 'INSTRUÇÃO' 'Pending legal review' '[Legal Entity'; do
  echo "=== $s"; grep -rIlF -- "$s" public server
done
```

To see the context of a hit: `grep -rIoF -- 'Representative' public | head` (add `-o` with surrounding characters using `grep -rIo ".\{60\}Representative.\{40\}" public`).

Expected result at the time of writing (observed in a local build; re-check, it can change):

| String | Expected | Why it is acceptable |
| --- | --- | --- |
| `$399` | 1 hit in a blog content chunk (`content-*.js`) | A salary range in a finance compensation post ("$246,000 – $399,000"), not the old pilot price |
| `$2,100`, `$4,500` | Blog content only | Cost-per-hire tables in benchmark posts, not retired plan prices |
| `Bronze`, `Pending legal review`, `[Legal Entity`, `INSTRUÇÃO` | No hits | Any hit is a failure. (`INSTRU` alone matches DOMPurify and is not the string.) |
| `Representative` | Several hits | Legitimate visible label "Representative data" on `/agents`, `/changelog`, `/how-it-works` and the evidence-graph demo, and the description "Representative engagements." in the resources chunk. Investigate any hit outside these. |
| `Unknown` | Hits in admin and client chunks | Status labels inside the signed-in workspace. Investigate any hit in a public route chunk or in `llms*.txt`. |

Also scan the static files and the generated text files: `grep -nF -e '$399' -e 'Bronze' public/llms.txt public/llms-full.txt public/ai.txt`.

Scan source for retired claims in public copy (excluding blog data and workspace code):

```sh
grep -rnE '\$399|\$2,100|\$4,500|Bronze|Pending legal review|\[Legal Entity|INSTRUÇÃO' src/routes src/config src/content/pages src/components/marketing | grep -v '__tests__'
```

## 2. Deploy

1. Record the exact commit (`git rev-parse HEAD`), the environment and the approved deployment method (Lovable publish from the connected branch). Deployment method and who clicks publish: Unknown, owner to confirm.
2. Deploy in reversible batches if possible (the commits are already separated by topic; see section 4).
3. Do not rewrite published git history (`AGENTS.md`: Lovable syncs the connected branch; avoid force-push, rebase or amend of pushed commits).

## 3. Post-deploy production checks

Set `HOST=https://taasflow.com`.

### 3.1 Status, canonical and robots matrix

```sh
HOST=https://taasflow.com
for p in / /pricing /pilot /how-it-works /security /about /faq /case-studies /for-hr-teams /for-founders \
  /flat-fee-recruiting /subscription-recruiting /recruitment-agency-alternative /ai-recruiting-agency \
  /recruiting-as-a-service /compare /recruiter-fees /ai-in-hiring /industries/healthcare /industries/hospitality \
  /book /intake /sample-shortlist /status /login; do
  html=$(curl -sS -L -o /tmp/p.html -w "%{http_code}" "$HOST$p")
  canon=$(grep -o '<link[^>]*rel="canonical"[^>]*>' /tmp/p.html | head -1)
  robots=$(grep -o '<meta[^>]*name="robots"[^>]*>' /tmp/p.html | head -1)
  xrt=$(curl -sSI "$HOST$p" | grep -i '^x-robots-tag' | tr -d '\r')
  echo "$p | $html | $canon | ${robots:-no robots meta} | ${xrt:-no x-robots-tag}"
done
```

Expected:

| Group | Status | Canonical | Robots meta | X-Robots-Tag |
| --- | --- | --- | --- | --- |
| The 20 key pages in `05-metadata-and-schema-inventory.md` | 200 | `https://taasflow.com` + path | none | none |
| `/book`, `/intake`, `/sample-shortlist`, `/status`, `/login` | 200 | self | `noindex` (with `follow` except `/login`) | none |

If any indexable page returns `noindex` or an `x-robots-tag`, the preview-host rule has leaked into production: stop and investigate (`src/lib/seo/edge-policy.ts`, `src/routes/__root.tsx`).

### 3.2 Redirect matrix

```sh
HOST=https://taasflow.com
for p in /platform /system /employer-onboarding /trust /journey /book-a-call /schedule /demo /pilot/intake \
  /industries/non-profit /industries/tech /resources/recruiting-as-a-service /PRICING \
  /blog/accounting-hiring-benchmarks-2026; do
  echo "$p -> $(curl -sSI "$HOST$p" | awk 'NR==1{s=$2} tolower($1)=="location:"{l=$2} END{print s, l}' | tr -d '\r')"
done
curl -sSI https://www.taasflow.com/pricing | head -3
```

Expected: 301 with these locations: `/how-it-works#workspace`, `/how-it-works#scoring`, `/how-it-works#steps`, `/security`, `/about#story`, `/book` (three times), `/intake`, `/industries/nonprofit`, `/industries/technology`, `/recruiting-as-a-service`, `/pricing`, `/blog/accounting-hiring-guide-2026`; `www` redirects to `https://taasflow.com/pricing`. A fragment is not sent by `curl` in some builds of the redirect; confirm the `Location` header text. No redirect chains (one hop).

### 3.3 Sitemap and robots

```sh
curl -sS https://taasflow.com/robots.txt
curl -sS https://taasflow.com/sitemap.xml
for c in pages industries blog; do curl -sS -o /dev/null -w "$c %{http_code}\n" https://taasflow.com/sitemap-$c.xml; done
curl -sS https://taasflow.com/sitemap-pages.xml | grep -c '<loc>'
```

Expected: `robots.txt` has one `User-agent: *` group and a single `Sitemap: https://taasflow.com/sitemap.xml`; `/sitemap.xml` is a `<sitemapindex>` with three children, each returning 200; no `noindex` path (list in `00-baseline-and-route-manifest.md` section 3) appears in any child; no `<changefreq>` or `<priority>`. Counts computed from the generator at time of writing: 44 page URLs, 4 industry URLs, 78 blog URLs.

Check that none of the noindex paths is listed: `for p in /book /intake /status /pitch /sample-shortlist; do curl -sS https://taasflow.com/sitemap-pages.xml | grep -c "taasflow.com$p<"; done` should print 0 each time.

### 3.4 Preview host stays noindex

```sh
curl -sSI https://clear-path-hubs.lovable.app/ | grep -i x-robots-tag
curl -sS https://clear-path-hubs.lovable.app/ | grep -o '<meta[^>]*name="robots"[^>]*>'
curl -sS https://clear-path-hubs.lovable.app/ | grep -o '<link[^>]*rel="canonical"[^>]*>'
```

Expected: `noindex, nofollow` in both places and a canonical pointing at `https://taasflow.com/`. The preview host name is taken from the audit and `docs/seo/canonical-policy.md`; confirm it is still current: Unknown, owner to confirm.

### 3.5 Content and funnel spot checks

| Check | How | Pass |
| --- | --- | --- |
| No retired claims on public HTML | `for p in / /pricing /pilot /enterprise /how-it-works /security /faq /about; do curl -sS https://taasflow.com$p \| grep -cE '\$399\|\$2,100\|\$4,500\|Bronze\|INSTRUÇÃO\|Pending legal review\|\[Legal Entity'; done` | 0 for each |
| Price consistent | `curl -sS https://taasflow.com/pricing \| grep -o '\$[0-9,]*' \| sort \| uniq -c` | Only prices from `src/config/pricing-core.ts` |
| FAQ answers in HTML | `curl -sS https://taasflow.com/faq \| grep -c '<details'` | More than 0, answer text present in the HTML |
| Pagination | `curl -sS 'https://taasflow.com/blog?page=2' \| grep -o '<link[^>]*canonical[^>]*>'` | Canonical is `https://taasflow.com/blog?page=2` (self) |
| Inquiry persists | Submit `/pilot` form with a test email | Row in `marketing_inquiries`; `generate_lead` visible in GA4 DebugView; no email or phone in event parameters |
| Booking | Book a test slot | `booking_confirmed` visible once |
| Checkout disabled | Visit `/checkout` while signed out | Redirect to sign-in, no payment form |
| Consent | Open `/` in a private window with an EU time zone | No Meta, LinkedIn, Clarity or Hotjar request before consent; GA4 cookieless; RB2B loads (owner decision) |

### 3.6 CDN cache

The audit found stale copies served from a pre-render cache (defect C1). Purge the CDN or pre-render cache **once**, immediately after the deploy, then re-run sections 3.1 and 3.5 using a query string and a plain URL and compare the output (`curl -sS "$HOST/pricing?x=$(date +%s)"` versus `curl -sS "$HOST/pricing"`). The CDN provider, who has access, and whether a pre-render cache exists are Unknown, owner to confirm. HTML is served with `public, max-age=0, must-revalidate` by `src/lib/seo/edge-policy.ts`, which should keep stale HTML from lingering after the purge.

## 4. Rollback plan

| Situation | Action |
| --- | --- |
| One topic is wrong (for example the funnel) | `git revert <commit>` for the named commit, push, redeploy. Revert newest first if commits depend on each other. |
| Everything must go back | Revert the range, newest to oldest, in one pass: `git revert --no-edit 96c2ba6 12fa29f e275a94 16a1886 eb6477e 16fc1dd 7956431 0bd07f9 7eaf52a b1dcfdb aca4f06 f00c531` and push. The audit baseline is `5a8ceb2`. Check `git log` first: other commits may have been added after this list was written. |
| Redirect or noindex mistake in production | Revert `src/config/legacy-redirects.ts`, `src/lib/seo/indexability.ts` or `src/lib/seo/blog-noindex.ts` alone and redeploy. Do not delete redirect entries as part of a rollback unless the destination itself is being reverted. |
| Lovable | The project is connected to Lovable and the branch syncs back. Use `git revert` (a new commit), never force-push, rebase, amend or squash pushed commits: that rewrites history on Lovable's side. Lovable's own version history in the editor can restore an earlier version as a fallback; use it only if git is unavailable. |
| Data | The SEO/CRO commits changed code and content. `git diff --stat 5a8ceb2..HEAD -- supabase` printed nothing when this was written, so the committed range adds no migration. Uncommitted work was not checked: re-run the command before reverting. |

After any rollback, purge the CDN once and re-run section 3.

## 5. Monitoring plan

### First 24 to 48 hours

- Google Search Console: Pages (indexing) report for new "Excluded by noindex" entries on URLs that should be indexable; Crawl stats for spikes in 4xx or 5xx; URL Inspection on `/`, `/pricing`, `/pilot`, `/flat-fee-recruiting` (live test: canonical, indexable, rendered HTML contains the content).
- Sitemaps: submit `https://taasflow.com/sitemap.xml` (the index) and confirm the three children are read. Remove any older sitemap submission that points at retired URLs.
- GA4: Realtime and DebugView for `lead_form_view`, `lead_form_start`, `generate_lead`, `booking_confirmed`; confirm no personal data in parameters; confirm no duplicate `generate_lead` per `submission_id`.
- Lead delivery: `/admin/lead-delivery` and the Teams channel; every test and real inquiry has a record; no retries stuck.
- Errors: `lead_form_error` rate by `error_code`; server logs for 5xx on `/pilot`, `/book`, `/intake`.
- Cache: re-run section 3.1 once more at 24 hours.

### Following weeks

- Search Console coverage trend: indexed count against the sitemap counts above; check that the 26 noindexed posts drop out and the 47 retired blog URLs are reported as redirected.
- Indexed staging host: search `site:clear-path-hubs.lovable.app` (and other preview hosts). If any appear, request removal in the Removals tool of the Search Console property for that host (owner must have access: Unknown), and confirm it still returns `noindex`.
- Bing Webmaster Tools: add and verify the site, submit the sitemap index, check coverage. IndexNow: not implemented in the repository (no key file or submission code found); adding it is optional and needs approval.
- Re-run the monthly AI-visibility check in `07-offsite-profile-drafts.md`.
- Review organic landing pages and queries once there is data; do not claim any ranking or traffic change before then.
- Revisit `08-owner-decisions-register.md` weekly until the blocking items are closed.
