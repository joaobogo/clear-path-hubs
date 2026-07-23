# Public CTA System

## Hierarchy

| Level | Component | Visual | Usage |
|---|---|---|---|
| Primary | `HeroCTAGroup` primary / `InlineCTA` / `EmployerCTA` | Solid navy button | Exactly one per section. Always the single most important action. |
| Secondary | `HeroCTAGroup` secondary / `CandidateCTA` | White button with navy border | Alternate paths. Never duplicates the primary. |
| Tertiary | `TextLinkCTA` | Underlined navy text with arrow | Inline reference within body copy. |
| Section-close | `SectionCTA` | Bordered white card | Close a content section with a single decision. |
| Final | `FinalCTASection` | Navy full-width block | Bottom-of-page conversion block. |

## Rules

- One primary per section. Two solid navy buttons on the same viewport is a bug.
- Button labels describe the action: `Start hiring`, `Browse jobs`, `Book a consultation`. Never `Learn more` unless there is no clearer verb.
- Every CTA points to a real destination route resolved from `src/config/public-navigation.ts`. No placeholder `href="#"`.
- External links get `target="_blank" rel="noopener noreferrer"` automatically (regex on `https?://`).
- CTAs never render loading state unless the click triggers an async action (they are navigation-only by default).

## Canonical destination map

| Label | Destination |
|---|---|
| Start hiring | `/intake` |
| Browse jobs | `/jobs` |
| View role | `/jobs/$id` |
| Apply | `/jobs/$id/apply` |
| Sign in | `/login` |
| Contact | `/contact` |
| Book a consultation | `/contact` (falls back until a booking route ships) |

## Anti-patterns removed

- Duplicate `Start hiring` buttons in the same hero.
- `Learn more →` links pointing to `#`.
- External links without `rel="noopener"`.
- Old auth entry `/auth` referenced from the header — now `/login`.
