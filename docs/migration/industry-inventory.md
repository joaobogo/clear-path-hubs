# Industry Inventory

Source: `https://taasflow.com/industries` — Destination: `/industries`.

- Source industries discovered: **22**
- Destination v2 entries present: **22**
- Slug mismatches requiring alias: **1**
- Missing destinations: **1** (`/industries/compare`)

## Industry rows

| Name | Source slug | Dest slug | Dest route | Status | Completeness | Decision |
|---|---|---|---|---|---|---|
| Technology | `tech` | `tech` | `/industries/tech` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Legal | `legal` | `legal` | `/industries/legal` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Public Sector | `public-sector` | `public-sector` | `/industries/public-sector` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Finance & Banking | `finance` | `finance` | `/industries/finance` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Staffing Agencies | `staffing-agencies` | `staffing-agencies` | `/industries/staffing-agencies` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Healthcare | `healthcare` | `healthcare` | `/industries/healthcare` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Sales | `sales` | `sales` | `/industries/sales` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Marketing & Advertising | `marketing` | `marketing` | `/industries/marketing` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Human Resources | `human-resources` | `human-resources` | `/industries/human-resources` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Accounting & Audit | `accounting` | `accounting` | `/industries/accounting` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Real Estate | `real-estate` | `real-estate` | `/industries/real-estate` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| SaaS & Cloud | `saas` | `saas` | `/industries/saas` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| E-commerce & Retail | `ecommerce` | `ecommerce` | `/industries/ecommerce` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Insurance | `insurance` | `insurance` | `/industries/insurance` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Construction & Architecture | `construction` | `construction` | `/industries/construction` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Hospitality & Events | `hospitality` | `hospitality` | `/industries/hospitality` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Media & Entertainment | `media` | `media` | `/industries/media` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Non-Profit | `non-profit` | `nonprofit` | `/industries/nonprofit` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE_WITH_SLUG_ALIAS |
| Private Equity & VC | `private-equity` | `private-equity` | `/industries/private-equity` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Cybersecurity | `cybersecurity` | `cybersecurity` | `/industries/cybersecurity` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Data & Analytics | `data-analytics` | `data-analytics` | `/industries/data-analytics` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |
| Consulting | `consulting` | `consulting` | `/industries/consulting` | DESTINATION_EXISTS | COMPLETE_SOURCE_PAGE | MIGRATE |

## Hub extras

| Industry Comparison | `compare` | `compare` | `/industries/compare` | MISSING_DESTINATION | COMPLETE_SOURCE_PAGE | HOLD_UNTIL_ROUTE_BUILT |

## Field coverage per industry

Each source page provides: canonical name, hero headline, subtitle, market-intelligence stats, hiring-challenges block, TaaSFlow solution block, positions/roles list, process (day-by-day) block, salary explorer, career progression, related industries and FAQ. See `industry-inventory.json` for the per-industry snapshot.