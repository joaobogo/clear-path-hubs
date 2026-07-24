# Industry Image License Register

**Status:** Complete — 57 / 57 industries have known license
**Companion:** `image-manifest.json`, `creative-identities.md`
**Generated:** 2026-07-24

---

## 1. Source & license summary

| Source | Count | License | Attribution | Commercial use |
|---|---|---|---|---|
| Unsplash CDN | 57 | Unsplash License (unsplash.com/license) | Not required (encouraged, not enforced) | ✅ Yes |
| Owner-approved commissioned | 0 | — | — | — |
| Client logo / trademark | 0 | — | — | — |
| Stock (Getty/Shutterstock) | 0 | — | — | — |

**Unknown license count: 0.**

## 2. Unsplash License terms (in scope)

All 57 hero photos are served from `images.unsplash.com` under the Unsplash License:

- Free for commercial and non-commercial use.
- No permission or attribution required (attribution encouraged as good practice).
- Cannot be resold as-is, cannot be used to compete with Unsplash, cannot be used for wallpaper/backdrop products.

Reference: https://unsplash.com/license

## 3. Photo ID register (57 rows)

The canonical source of truth is `image-manifest.json` (field `industries.<slug>.hero.unsplashId`). This register is a human-readable mirror grouped by category.

### Tech & Data (12)
`ai-ml` 1677442136019-21780ecad995 · `cybersecurity` 1550751827-4bd374c3f58b · `data-analytics` 1543286386-713bdd548da4 · `devops` 1573164713714-d95e436ab8d6 · `edtech` 1522202176988-66273c2fd55f · `fintech` 1611974789855-9c2a0a7236a3 · `gaming` 1542751371-adc38448a05e · `healthtech` 1584982751601-97dcc096659c · `proptech` 1486406146926-c627a92ad1ab · `saas` 1551288049-bebda4e38f71 · `tech` 1517430816045-df4b7de11d1d · `web3` 1639762681485-074b7f938ba0

### Operations & Services (11)
`agriculture` 1500595046743-cd271d694d30 · `automotive` 1493238792000-8113da705763 · `aviation` 1436491865332-7a61a109cc05 · `energy` 1466611653911-95081537e5b7 · `fashion` 1490481651871-ab68de25d43d · `food-beverage` 1504674900247-0877df9cc836 · `oil-gas` 1518623489648-a173ef7824f3 · `renewable-energy` 1509390874189-d75d5b71a9c9 · `sports` 1461896836934-ffe607ba8211 · `telecom` 1451187580459-43490279c0fa · `travel` 1507525428034-b723cf961d3e

### Regulated & Public (10)
`biotech` 1581093588401-fbb62a02f120 · `defense` 1541185933-ef5d8ed016c2 · `education` 1503676260728-1c00da094a0b · `healthcare` 1519494026892-80bbd2d6fd0d · `higher-education` 1541339907198-e08756dedf3f · `legal` 1589994965851-a8f479c573a9 · `medical-devices` 1580281657527-47f249e8f4df · `nonprofit` 1593113646773-028c64a8f1b8 · `pharmaceuticals` 1587854692152-cbe660dbde88 · `public-sector` 1541872703-74c5e44368f9

### Financial Services (4)
`accounting` 1554224154-26032ffc0d07 · `finance` 1554224155-8d04cb21cd6c · `insurance` 1450101499163-c8848c66ca85 · `private-equity` 1519389950473-47ba0277781c

### Professional Services (4)
`architecture` 1487958449943-2429e8be8625 · `investment-banking` 1554224155-6726b3ff858f · `venture-capital` 1556761175-5973dc0f32e7 · `wealth-management` 1560520653-9e0e4c89eb11

### Consumer & Operations (4)
`ecommerce` 1607082349566-187342175e2f · `hospitality` 1566073771259-6a8506099945 · `logistics` 1601584115197-04ecc0da31d1 · `retail` 1441986300917-64674bd600d8

### Go-to-Market (3)
`marketing` 1552664730-d307ca884978 · `media` 1478737270239-2f02b77fc618 · `sales` 1552581234-26160f608093

### People & GTM (3)
`customer-success` 1560264280-88b68371db39 · `design` 1558655146-9f40138edfeb · `product-management` 1531403009284-440f080d1e12

### People & Advisory (3)
`consulting` 1517502884422-41eaead166d4 · `human-resources` 1573497019940-1c28c88b4f3e · `staffing-agencies` 1600880292203-757bb62b4baf

### Built Environment & Industrial (3)
`construction` 1541888946425-d81bb19240f5 · `manufacturing` 1565043666747-69f6646db940 · `real-estate` 1512917774080-9991f1c4c750

## 4. Duplicate audit

Prior collision: `aviation` and `travel` both used Unsplash ID `1436491865332-7a61a109cc05`. Resolved on 2026-07-24 by moving `travel` to `1507525428034-b723cf961d3e`. **Current duplicate count: 0.**

## 5. Change process

- Any hero replacement must update `src/content/industry-hero-photos.ts`, `image-manifest.json`, and this register in the same commit.
- The commissioning owner may swap Unsplash entries for licensed commissions later; when that happens, add a `source: "commissioned"` field and record the vendor + purchase reference here.
- Never commit binary hero files to the repo — use the Lovable Assets CDN or keep the Unsplash CDN URL.
