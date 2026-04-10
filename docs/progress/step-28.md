# Step 28 — Hero Rotation And Symbol Cleanup

**Date:** 2026-04-09  
**Scope:** Replace the crowded desktop hero with a focused rotating showcase, rewrite the hero copy around actual Koya product value, redesign the premium card stage, and remove flag-like fiat iconography.

---

## Problem Being Solved

The first landing-page depth sweep improved structure, but the hero still missed on four important points:

- The desktop composition still felt crowded because several panels competed in one scene
- The hero copy talked about interface depth instead of clearly stating what Koya does
- The hero card looked generic rather than like a premium product surface
- The KES badge read like a country flag rather than a currency symbol

## What Changed

### 1. Hero Copy Rewritten Around Product Value

`apps/web/components/marketing/hero-section.tsx`

- Replaced design-meta messaging with direct Koya product copy focused on M-Pesa deposits, multi-currency wallets, Bitcoin conversion, premium cards, and global investing
- Tightened the support cards under the hero so each one reinforces a real product capability instead of abstract brand language

### 2. Desktop Hero Rebuilt As A Rotating Showcase

`apps/web/components/marketing/hero-section.tsx`

- Removed the buried multi-panel desktop composition and replaced it with one focused stage that rotates through Wallets, Convert, Card, and Activity views
- Used Framer Motion transitions and manual selection controls so the hero can show one strong idea at a time without feeling static
- Added a pause-on-select behavior so users can inspect a chosen stage without fighting autoplay

### 3. Premium Card Stage Upgraded

`apps/web/components/marketing/hero-section.tsx`

- Replaced the flatter hero card with a denser card surface using restrained highlights, sheen motion, stronger material contrast, and clearer wallet-linked context
- Reframed the surrounding card copy so the card reads as part of the Koya system, not as a detached marketing prop

### 4. Fiat Symbols Made Currency-First

`apps/web/components/marketing/asset-icons.tsx`

- Removed the flag-like KES treatment and replaced both USD and KES with currency-first monogram badges
- Kept the shapes compact and recognisable in wallet rows, ticker cells, and hero surfaces without leaning on national flag motifs

## Why These Decisions Matter

- **One strong stage beats four weak ones:** the hero now has a clearer reading order on desktop
- **Product language builds trust:** financial landing pages should say what the product does, not describe their own styling
- **Premium means material quality:** the card needed to feel authored and connected to the system, not generated
- **Currencies are not flags:** treating fiat symbols as currencies instead of national branding avoids a cheap or inaccurate feel

## Files Changed

| File | Change |
|------|--------|
| `apps/web/components/marketing/hero-section.tsx` | Rewrote hero copy, added rotating desktop showcase, and redesigned the card stage |
| `apps/web/components/marketing/asset-icons.tsx` | Replaced USD/KES with currency-first monogram badges |
| `tasks/todo.md` | Recorded completion and verification |
| `docs/progress/step-28.md` | This file |

## Verification

- `pnpm nx build web` ✅

## Risks And Tradeoffs

- The rotating stage adds motion logic, so future hero additions should stay disciplined and avoid turning the stage back into a pile of simultaneous panels
- The fiat badges are intentionally restrained; if more fiat currencies are added later, they should follow the same currency-first system rather than introducing new one-off motifs