# Tracking pixels

All tags live in `src/lib/tracking/pixels.ts` and are injected client-side after hydration.

## Live by default
| Tag | Env var | Default ID |
| --- | --- | --- |
| GA4 | `VITE_GA_MEASUREMENT_ID` | `G-HJ2ECKCNK4` |
| Apollo | `VITE_APOLLO_APP_ID` | `6981f9ca9255870019505836` |
| RB2B | `VITE_RB2B_ID` | `1N5W0H7RVEO5` |

## Enable by setting the env var
| Tag | Env var | Value format |
| --- | --- | --- |
| Meta Pixel | `VITE_META_PIXEL_ID` | 15-digit pixel ID |
| LinkedIn Insight | `VITE_LINKEDIN_PARTNER_ID` | numeric partner ID |
| Microsoft Clarity | `VITE_CLARITY_ID` | 10-char project ID |
| Hotjar | `VITE_HOTJAR_ID` | numeric site ID |

Set the value, redeploy, and the tag self-injects on first render. No code change needed.

## Verification
In the browser console on any page:

```js
window._taasflow_tracking.verify()
```

`loaded` = script injected and global present, `missing-config` = env var not set.

Verified end-to-end with test IDs (2026-07-29): all four load their remote scripts
(`connect.facebook.net/en_US/fbevents.js`, `snap.licdn.com/li.lms-analytics/insight.min.js`,
`clarity.ms/tag/<id>`, `static.hotjar.com/c/hotjar-<id>.js`) on `/`, `/pricing` and `/jobs`,
and receive SPA page-view + event dispatches through `trackEvent`
(Meta events mapped via `META_EVENT_MAP`, LinkedIn via `lintrk`, Clarity/Hotjar via their queues).
PII keys are stripped from every payload before dispatch.
