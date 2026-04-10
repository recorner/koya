# Step 27 — Landing Page Depth Sweep

**Date:** 2026-04-09  
**Scope:** Premium landing-page depth, stronger CTA surfaces, authentic asset icon treatment, smoother ribbon motion, and mobile-safe hero / How It Works layouts.

---

## Problem Being Solved

The public landing page looked flatter and cheaper than the Koya brand requires.

- The hero relied on too many floating loops and an absolute-positioned scene that collapsed badly on mobile
- Primary and secondary buttons felt generic and under-specified for a premium fintech surface
- Fiat asset icons looked improvised because they were browser-text glyphs inside flat circles
- The market ribbon could visibly stutter because live price updates changed item widths while the whole track was animating
- `How It Works` used ruler/progress-line cues that read like template chrome and broke down on smaller screens

## What Changed

### 1. Hero Composition Rebuilt

`apps/web/components/marketing/hero-section.tsx`

- Replaced the old one-size-fits-all hero scene with two deliberate compositions:
  - a mobile stack with one stable dashboard panel plus compact conversion/card previews
  - a desktop scene with layered depth but no noisy perpetual breathing loops
- Tightened wallet row alignment with real asset icons, tabular balances, and a consistent three-column structure
- Reworked action tiles and supporting trust cards so the right side reads like a real operating surface instead of marketing illustration noise

### 2. Button Surfaces Upgraded

`apps/web/components/ui/button.tsx`

- Added real depth to the default, outline, and secondary variants with layered gradients, restrained shadows, and clearer press/focus feedback
- Replaced broad `transition-all` behavior with targeted surface transitions so buttons feel more deliberate

### 3. Asset Icons Made More Authentic

`apps/web/components/marketing/asset-icons.tsx`

- Replaced the old fiat icons, which depended on system-font text rendering, with vector badge artwork for USD and KES
- Kept crypto icons recognizable while improving cross-icon consistency in the hero and ribbon contexts

### 4. Ribbon Motion Stabilized

`apps/web/components/marketing/market-ribbon.tsx`  
`apps/web/app/globals.css`

- Converted ticker items to fixed-width grid cells so live price changes no longer alter the animated track width
- Tightened the ribbon background, borders, and edge masks so it reads as a darker market tape rather than an orange strip
- Added GPU-safe transform hints and reduced-motion behavior that fully stops the animation when appropriate

### 5. How It Works Reframed

`apps/web/components/marketing/how-it-works.tsx`

- Removed the ruler/progress-line treatment and replaced it with heavier step cards that feel more architectural
- Rewrote the copy to sound calmer and more premium
- Changed the mobile layout so the sidebar information collapses into useful cards instead of a broken vertical stack

## Why These Decisions Matter

- **Depth over decoration:** Koya should feel substantial through layering, spacing, and material quality, not through loud gradients or constant motion
- **Financial clarity first:** wallet balances, conversion previews, and CTA states now align more cleanly and feel safer to read
- **Mobile is not a fallback:** the hero and `How It Works` now have mobile-specific structure instead of inheriting desktop assumptions
- **Authenticity matters:** symbol/icon quality strongly affects trust on a financial landing page; improvised glyphs degrade that trust fast

## Files Changed

| File | Change |
|------|--------|
| `apps/web/components/marketing/hero-section.tsx` | Rebuilt hero layout for depth, alignment, and mobile stability |
| `apps/web/components/ui/button.tsx` | Upgraded shared CTA surfaces and interaction states |
| `apps/web/components/marketing/asset-icons.tsx` | Replaced flat fiat glyph icons with vector badge artwork |
| `apps/web/components/marketing/market-ribbon.tsx` | Fixed-width ticker cells and stronger ribbon treatment |
| `apps/web/app/globals.css` | Ribbon transform hardening and reduced-motion behavior |
| `apps/web/components/marketing/how-it-works.tsx` | Replaced ruler-like step UI with card-based progression |
| `tasks/todo.md` | Recorded completion and build verification |
| `docs/progress/step-27.md` | This file |

## Verification

- `pnpm nx build web` ✅

## Risks And Tradeoffs

- The hero now prioritizes clarity and stable layering over constant kinetic motion; this is intentional, but it makes the surface calmer than the previous animated version
- Fiat icon artwork is custom, so future additions should follow the same badge approach instead of reverting to text-in-circle placeholders
- The ribbon remains animated, but because item widths are fixed the motion should feel materially smoother under live updates