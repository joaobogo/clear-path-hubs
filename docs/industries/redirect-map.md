# Industry Redirect Map (Draft)

Draft rules. Nothing is enforced in code until an owner signs off on the canonical form for the one open conflict.

## Active redirects required now

| From | To | Reason | Status |
| --- | --- | --- | --- |
| `/industries/nonprofit` | `/industries/non-profit` | Slug identity conflict between source manifest and the live route/detail page. Canonical proposed: `non-profit`. | **Pending owner approval** |

## Placeholder rules (activate as detail pages ship)

Common alias inputs users may type/link that should route to the canonical slug once the target page exists. Do not enforce until the destination detail page is published (see `canonical-57-manifest.md`, "pending" list).

| Alias | Canonical slug |
| --- | --- |
| `/industries/non-profits` | `/industries/non-profit` |
| `/industries/ai` | `/industries/ai-ml` |
| `/industries/machine-learning` | `/industries/ai-ml` |
| `/industries/health-tech` | `/industries/healthtech` |
| `/industries/fin-tech` | `/industries/fintech` |
| `/industries/e-commerce` | `/industries/ecommerce` |
| `/industries/vc` | `/industries/venture-capital` |
| `/industries/pe` | `/industries/private-equity` |
| `/industries/oil-and-gas` | `/industries/oil-gas` |
| `/industries/food-and-beverage` | `/industries/food-beverage` |
| `/industries/higher-ed` | `/industries/higher-education` |

## Notes

- The routing runtime is TanStack Start — implement redirects with a `beforeLoad` throw in a splat route, not with hosting-level rewrites.
- No redirect is added until its destination content exists. Redirecting to a 404 is worse than the raw alias.
- Owner-approved changes only. No inventions.
