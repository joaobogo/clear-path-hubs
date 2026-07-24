# TaaSFlow Component Language

The rules every UI primitive follows so the product and public site feel like one system.

**Universal rule.** A component reads only shadcn semantic classes (`bg-primary`, `text-muted-foreground`, `border-border`, `bg-card`, `text-foreground`, `bg-sidebar`, …) or `--taas-*` custom properties. It never hardcodes hex, oklch, or fixed pixel colors. Variants are declared with `cva`; state is expressed through variants, not inline overrides.

---

## Card anatomy (canonical)

```text
┌──────────────────────────────────────────────────┐  ← surface: bg-card
│  ┌ eyebrow (meta-sm, text-muted-foreground) ─┐   │     border: border, --taas-radius-card
│  │ CATEGORY · TIME                            │   │     shadow: --taas-shadow-2
│  └────────────────────────────────────────────┘   │
│                                                    │
│  Title (h3, text-foreground, leading-snug)        │
│  Supporting line (body-sm, text-muted-foreground) │
│                                                    │
│  ┌ body region ─────────────────────────────────┐ │
│  │ metrics · chips · content                    │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌ footer (border-t border, pt-3) ──────────────┐ │
│  │ primary action │ secondary │ meta right     │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

Padding: `p-5` (dense) / `p-6` (default) / `p-8` (feature). Never mix inside one screen.

---

## Buttons

Variants (declared in `src/components/ui/button.tsx` with `cva`):

| Variant     | Use                                       | Tokens                                   |
| ----------- | ----------------------------------------- | ---------------------------------------- |
| `default`   | Primary action, one per view              | `bg-primary text-primary-foreground`     |
| `secondary` | Secondary action                          | `bg-secondary text-secondary-foreground` |
| `outline`   | Tertiary, high-emphasis surfaces          | `border border-input bg-background`      |
| `ghost`     | Toolbar, in-card, table row               | transparent → `bg-accent` on hover       |
| `link`      | Inline text action                        | underline-offset, `text-primary`         |
| `destructive` | Destructive confirmation                | `bg-destructive text-destructive-foreground` |

Sizes: `sm` (h-9), `default` (h-10), `lg` (h-11), `icon` (10×10). Radius: `--taas-radius-control`. Focus ring is global (`brand-tokens.css`), never per-button.

---

## Inputs, textareas, selects

- Height matches button (`h-10` default). Radius `--taas-radius-control`.
- Border: `border-input`; focus: `ring-2 ring-ring ring-offset-2 ring-offset-background`.
- Placeholder: `text-muted-foreground` at 100% opacity — no lighter greys.
- Error state: red border + `--taas-status-danger-foreground` help text (never red placeholder).
- Label pairs are always `<Label>` + input, `space-y-2`; helper text is `text-xs text-muted-foreground`.

---

## Chips / badges

Three classes exist and no fourth is introduced:

- `taas-chip` + `taas-chip-{success|warning|danger|info|neutral}` — soft, pill, meta-sm.
- shadcn `<Badge>` for numeric counts.
- Score pills for candidate scores (see below).

Score chip color is bound to `--taas-score-*` bands only. Stage chip color is bound to `--taas-stage-*` only. No component invents its own color pairing.

---

## Tables

- Header row: `text-xs uppercase tracking-wide text-muted-foreground`.
- Row hover: `bg-muted/60`.
- Selected row: `bg-primary/5` (mapped from `--taas-interactive-selected`).
- Zebra: none. Alignment: numbers right, text left, chips left with `whitespace-nowrap`.
- Dense (workspace) tables use `text-sm`, `h-11` rows; marketing/data tables use `text-base`, `h-14`.

---

## Dialogs, sheets, popovers

- Dialog: `--taas-radius-surface`, `--taas-shadow-5`, backdrop `bg-background/80 backdrop-blur-sm`.
- Sheet: side-anchored, full height, `--taas-shadow-4`. Motion `slide-in-right` at `--taas-motion-slow`.
- Popover: `--taas-radius-card`, `--taas-shadow-3`, `p-3` default. Arrow uses `border-border` color.

---

## Tabs

- Trigger: `text-muted-foreground` idle → `text-foreground` active with 2px underline in `--taas-brand-primary`.
- No pill-style tabs on workspace surfaces; pill tabs allowed only on marketing (`/how-it-works`, `/pitch`).

---

## Empty, loading, error states

Every list, table, card grid, chart, and detail panel MUST implement four states:

1. **Loading** — matching skeleton (`PanelSkeleton`, `TableSkeleton`, `ScoreTileSkeleton`) at the same footprint as the loaded state.
2. **Empty** — icon (24px, muted), one-line explanation, one primary action or link.
3. **Error** — red-tinted card with retry action; never a full-screen error unless the route itself failed.
4. **Success** — the actual content.

Loading pulses are the only allowed motion loop.

---

## Iconography

- Library: `lucide-react`. Stroke 1.5 (UI) / 1.75 (marketing tiles).
- Semantic pairs: `Check` = success, `AlertCircle` = warning, `XCircle` = danger, `Info` = info. Do not reassign.
- Never place an icon larger than 32px inside a button.

---

## Score explainability block

Every candidate surface that shows a score also shows:

1. Score chip using `--taas-score-*`.
2. `engine_version` and `contradiction_status` badges via `<EvaluationProvenance>`.
3. At least one `cv_quote` evidence line (or a "review evidence" affordance).

Rule enforced by `docs/design/dashboard-brand-audit.md`. A score without evidence is a bug.

---

## Client brand overlay (enterprise)

- Applied only through `<ClientBrandHeader>`.
- Client logo max height 32px, next to TaaSFlow lockup with a 1px separator.
- Client `brand_primary_color` / `brand_accent_color` never overwrite `--taas-brand-primary`; they are consumed only inside the header lockup and portfolio hero.
- "Delivered on TaaSFlow" ribbon is required at footer of any client-branded screen shared externally.

---

## What breaks the language

- Using `bg-white` / `bg-black` / arbitrary hex outside the illustration allowlist (`docs/design/taasflow-creative-system.md` §11).
- Component-local `const NAVY = '#…'`.
- Adding a new "brand" color that isn't already a token.
- Duplicating shadcn semantic tokens instead of mapping through `@theme inline`.
- Motion durations outside `--taas-motion-*`.
- Cards without one of the four states above.
