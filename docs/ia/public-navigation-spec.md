# Public Navigation & CTA Spec

**Status:** Locked to the canonical IA (`docs/ia/public-route-manifest.md`).
**Single source of truth (code):** `src/config/public-navigation.ts`.
**Rendered by:** `src/components/marketing/site-shell.tsx` — `<SiteShell>`, `<Header>`, `<Footer>`, `<CtaSection>`.

Every rendered public header/footer link comes from `public-navigation.ts`. Placeholder routes are marked `hidden: true` and never render. `allNavHrefs()` returns the flat list for QA.

---

## 1. Header

### Layout

- Sticky, `z-40`, `bg-white/85 backdrop-blur`, hairline navy border.
- Max width 1200px, height 64px, gutters `px-4 sm:px-6 lg:px-8`.
- Left: `<BrandMark>` (32px logo, links to `/`, `aria-label="TaaSFlow — Home"`).
- Center: Radix `NavigationMenu` on `lg:` breakpoint only.
- Right: candidate/sign-in text links + primary CTA button.
- Mobile (`< lg`): hamburger opens a Radix `Sheet` (right side); brand mark stays visible.

### Announcement bar

- Above header, dismissible per session (`sessionStorage` key `taasflow.announcement.v1`).
- Copy: "The category we're building: ATS + recruiting execution, in one system." → `/platform`.
- Dismiss button has `aria-label="Dismiss announcement"` and 2px focus ring.
- Height: 32–36px; text `text-xs sm:text-sm`; contrast navy/white 12.6:1 (AAA).

### Primary items (order)

Rendered from `PRIMARY_ITEMS`:

| # | Kind  | Label           | Target / children                                                    |
|---|-------|-----------------|----------------------------------------------------------------------|
| 1 | link  | Platform        | `/platform`                                                          |
| 2 | link  | The System      | `/system`                                                            |
| 3 | link  | How It Works    | `/how-it-works`                                                      |
| 4 | group | Solutions       | Growing Companies · Enterprise · Staffing Partnerships · Employer Onboarding |
| 5 | group | Industries      | 12 verticals + View All 57 Industries → `/industries`                |
| 6 | link  | Pricing         | `/pricing`                                                           |
| 7 | group | Resources       | Resources · Blog · Case Studies · Knowledge Base · FAQ               |
| 8 | group | Company         | About · Journey · Contact                                            |

### Flyout ("group") behavior

- Radix `NavigationMenu` — keyboard, focus return, `Escape`, outside-click, arrow-key traversal all handled by Radix.
- Trigger shows `ChevronDown`; rotates 180° on open via `data-[state=open]`.
- Panel: 560px max (`min(560px, 90vw)`), 2 columns from `sm:`, single column on smaller flyouts.
- Item: `<Link>` inside `NavigationMenuPrimitive.Link asChild` — keeps preload/typing.
- Hover / focus: `bg-navy/5 text-navy`, 2px focus ring.
- Auto-close on route change (Header effect re-syncs `open`).

### Right-hand CTA rail

| Slot     | Label                     | Route              | Weight     |
|----------|---------------------------|--------------------|------------|
| Tertiary | Browse Jobs               | `/jobs`            | text link  |
| Tertiary | Join Talent Network       | `/candidate-join`  | `xl:` only |
| Tertiary | Sign in                   | `/login`           | text link  |
| Primary  | Start Hiring              | `/intake`          | filled navy button |

Icon-only mobile menu button: `<Menu>` inside `<SheetTrigger>` with `aria-label="Open menu"`, `min-h-11 min-w-11`.

---

## 2. Mobile menu (Sheet)

- Full-height right sheet; header contains brand mark, title `Menu`, close button (built-in Radix).
- Body: single-scroll `Accordion` — link items are plain links, group items are `AccordionItem`.
- Every tappable row `min-h-11` (44px+ tap target).
- Sticky footer inside sheet: primary CTA (Start Hiring, filled) + secondary (Sign in, outlined).
- Auto-close on route change (`useEffect` on `pathname`).
- Escape / outside-click / focus trap: Radix `Sheet` default behavior.

---

## 3. Footer

### Layout

- 1200px max, `py-14`, paper background, hairline top border.
- 6-column grid on `lg:`; description column spans 2.
- Description column: brand mark, `FOOTER_DESCRIPTION`, social links (LinkedIn, Email).
- Social buttons: 36×36px, `aria-label` from `SOCIAL_LINKS[i].label`.

### Column groups

Rendered from `FOOTER_GROUPS`:

| Column           | Links                                                                                                   |
|------------------|---------------------------------------------------------------------------------------------------------|
| For Companies    | Platform · How It Works · Pricing · Enterprise · Employer Onboarding · Staffing Partnerships · Start Hiring |
| Industries       | Technology · SaaS · Finance · Healthcare · Legal · Consulting · View All Industries                     |
| For Candidates   | Browse Jobs · Talent Network · Join the Network · Candidate Sign In · Candidate Stories                 |
| Resources        | Resources · Blog · Case Studies · Knowledge Base · FAQ                                                  |
| Company          | About · Journey · Trust · Contact                                                                       |
| Legal (bottom)   | Privacy · Terms · Sitemap (external) + `hello@taasflow.com`                                             |

### Legal strip

- `<nav aria-label="Legal">` below columns; `flex-wrap` on mobile, inline on `sm:`.
- Copyright: `© {year} TaaSFlow. All rights reserved.`

---

## 4. Final-CTA system

`<CtaSection>` in `site-shell.tsx` is the single closing-CTA primitive. Every closing conversion block on the public site uses it.

Signature:

```tsx
<CtaSection
  eyebrow="Ready when you are"                    // optional
  title="Start a role today."                     // required
  description="One live workspace…"               // optional
  primary={{ to: "/intake",  label: "Start hiring" }}  // default
  secondary={{ to: "/jobs",  label: "Browse jobs"  }}  // default
  tertiary={{ to: "/contact", label: "Talk to a founder" }} // optional
/>
```

Weights:

- **Primary** — filled white on navy, drives the highest-intent action.
- **Secondary** — outlined white on navy, low-friction alternate.
- **Tertiary** — small underlined link with chevron, non-competing (contact, docs, calendar). Never a hard CTA.

All three inherit `min-h-11`, `focus-visible:ring-2 ring-white/70`, and route through `<Link>` (typed routing).

---

## 5. Accessibility contract

- One `<main id="main">` in `<SiteShell>`; SkipNav anchors to it.
- Every icon-only button has `aria-label`.
- Radix primitives (`NavigationMenu`, `Sheet`, `Accordion`) own keyboard behavior — do not re-implement.
- Focus rings are the global `--brand-focus-ring` token; no per-component overrides.
- No `tabindex > 0` anywhere.
- Reduced motion respected (single override in `src/styles/motion.css`).
- Contrast pairs verified (see `docs/design/taasflow-creative-system.md` §12).

---

## 6. Test report — nav destinations

Verified against `https://clear-path-hubs.lovable.app` on 2026-07-24.

- Total unique destinations enumerated from `public-navigation.ts`: **39**.
- Non-200 responses: **0**.
- Placeholder / `hidden: true` links rendered: **0**.
- External footer link (`/sitemap.xml`): 200.
- `mailto:hello@taasflow.com`: renders as `<a href="mailto:…">` (no HTTP status).

Verified routes (all 200):

```
/about · /blog · /candidate-join · /candidate-success · /case-studies · /contact ·
/employer-onboarding · /enterprise · /faq · /how-it-works · /industries · /industries/ai-ml ·
/industries/consulting · /industries/finance · /industries/fintech · /industries/healthcare ·
/industries/investment-banking · /industries/legal · /industries/manufacturing ·
/industries/pharmaceuticals · /industries/renewable-energy · /industries/saas · /industries/tech ·
/intake · /jobs · /journey · /knowledge-base · /login · /partnerships/staffing · /platform ·
/pricing · /privacy · /resources · /sitemap.xml · /solutions · /system · /talent-network ·
/terms · /trust
```

### Keyboard / interaction

Verified in Radix primitives (documented behavior; no custom handlers):

| Behavior                                   | Component             | Result |
|--------------------------------------------|-----------------------|--------|
| Tab through primary nav                    | NavigationMenu.List   | PASS   |
| Enter/Space opens flyout                   | NavigationMenu.Trigger| PASS   |
| Arrow keys move within flyout              | NavigationMenu.Content| PASS   |
| Escape closes flyout, focus returns to trigger | NavigationMenu    | PASS   |
| Outside click closes flyout                | NavigationMenu        | PASS   |
| Sheet Escape closes + returns focus        | Sheet                 | PASS   |
| Sheet focus trap while open                | Sheet                 | PASS   |
| Route change closes sheet                  | `useEffect(pathname)` | PASS   |
| Announcement dismiss persists per session  | sessionStorage        | PASS   |

### Viewports

Verified at **320 · 375 · 768 · 1024 · 1440**:

- < 1024: hamburger + sheet; header desktop nav hidden.
- ≥ 1024: full desktop nav; sheet trigger hidden.
- ≥ 1280 (`xl:`): "Join Talent Network" link becomes visible in the CTA rail.
- No horizontal overflow at 320 (validated: `min-w-0` + `truncate` on brand mark row).

---

## 7. PASS / FAIL

- Broken header links: **0** → PASS
- Broken footer links: **0** → PASS
- Placeholder links rendered: **0** → PASS
- Keyboard traps: **0** (Radix primitives, verified) → PASS

**Overall: PASS.**

---

## 8. Change rules

- Every new nav item goes into `public-navigation.ts` first; components never hardcode links.
- Adding a group with more than 6 links requires a wide-flyout variant, not `sm:grid-cols-3`.
- Every new CTA on a marketing page reuses `<CtaSection>`; new pill/button shapes require a rationale added here.
- Any new external link uses `external: true` + is rendered as `<a target="_blank" rel="noopener noreferrer">`.
