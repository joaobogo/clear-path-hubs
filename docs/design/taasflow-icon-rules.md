# TaaSFlow Icon Rules

**Library:** `lucide-react` only. Do not mix icon families (no Heroicons, no Feather, no Font Awesome).

## Sizes
Approved: **12, 14, 16, 18, 20, 24, 28, 32**. Pick the nearest; never freeform.

- Inline with body text: 14–16
- Buttons, form fields: 16–18
- Nav items, KPI badges: 20
- Section headers, empty-state hero icons: 24–32

## Stroke
`strokeWidth={1.75}` everywhere. Do not thicken on hover.

## Alignment
- Optically center via flex, never magic-number margins.
- Icons in buttons: 8px gap from label.
- Icons in inputs: 12px gap from left/right edge.

## Accessibility
- Icon-only buttons **must** have `aria-label` and a tooltip.
- Decorative icons **must** have `aria-hidden="true"` and no accessible name.
- Never rely on icon alone to communicate status — pair with text (`StatusBadge`).

## Categories

| Category    | Examples                                    | Notes |
| ----------- | ------------------------------------------- | ----- |
| Navigation  | Home, LayoutDashboard, Users, Briefcase     | Sidebar 20px, active state uses brand.ocean. |
| Actions     | Plus, Pencil, Trash2, Download, Send        | Match button variant; destructive = danger. |
| Status      | CheckCircle2, AlertTriangle, XCircle, Clock | Paired with StatusBadge text. |
| KPI         | TrendingUp, TrendingDown, Minus             | Rendered inside `KpiCard`. |
| Files       | FileText, Paperclip, Download               | 16px in tables, 20px in headers. |
| Empty state | Inbox, SearchX, PackageOpen                 | 32px inside `EmptyState`. |
| Social      | Github, Linkedin, Twitter                   | Only in footer; monochrome. |

## Illustrations
No decorative illustrations in workspace surfaces. Public surfaces may use restrained line illustrations tied to the navy/ocean palette. Never migrate legacy illustration styles that conflict with the premium CRM/ATS tone.
