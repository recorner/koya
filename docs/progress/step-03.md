# Step 03 — Landing Page Polish Pass

**Status:** Complete  
**Date:** 2026-03-10

---

## Scope

Targeted refinement pass on the Koya landing page. Five areas: icon strategy, navbar scroll, mobile spacing, How It Works redesign, and footer icons. No rebuild, no backend changes.

---

## 1. Icon Strategy Overhaul

### Libraries added
| Library | Purpose | Import style |
|---------|---------|--------------|
| `@web3icons/react` | Crypto/token icons (BTC, USDC, USDT) | Individual: `@web3icons/react/icons/tokens/TokenBTC` |
| `@icons-pack/react-simple-icons` | Brand/social icons (Apple, Tesla, GitHub, X, Discord) | Barrel: `import { SiApple } from '@icons-pack/react-simple-icons'` |
| `lucide-react` | Generic UI icons (unchanged) | Named exports |

**Note:** `@icons-pack/react-simple-icons` individual icon paths (`./icons/SiApple`) don't resolve with Next.js due to missing `types`/`import` conditions in the package's exports map. Barrel import required.

### Local SVG asset
- **M-Pesa icon** — `components/marketing/mpesa-icon.tsx`
- Custom SVG with Safaricom green (#4CAF50), stylized "M" mark
- Rounded rect background, not a circle — distinctive from token icons

### What changed in `asset-icons.tsx`
- BTC/USDC/USDT replaced with `@web3icons/react` branded token icons
- Apple/Tesla stock icons now use `@icons-pack/react-simple-icons`
- Microsoft kept as custom SVG (4-color grid is distinctive, not in simple-icons as a clean mark)
- SPY kept as custom chart SVG (no brand icon exists for S&P 500 ETF)
- USD/KES kept as custom SVG (no standard lib for fiat currency marks)
- M-Pesa re-exported from local `mpesa-icon.tsx`
- Stock icons wrapped in `StockIconWrapper` for consistent circular/rounded backgrounds

---

## 2. Navbar Scroll Fix

**File:** `components/marketing/site-header.tsx`

### Problem
White `border-b border-white-5` on scroll created a murky flash — felt cheap.

### Fix
- Removed the white border entirely
- Scrolled state uses: `bg-vault-black/90 backdrop-blur-2xl` with a subtle composite shadow:
  `shadow-[0_1px_0_rgba(255,255,255,0.04),0_4px_24px_rgba(0,0,0,0.4)]`
- Transition duration increased to 500ms for smoother state change
- Mobile menu border softened to `border-white-5/50`

---

## 3. Mobile Header Spacing

**File:** `components/marketing/site-header.tsx`

### Problem
`px-6` padding and `h-16` height too large on small screens — felt unrealistic on phones.

### Fix
- Container padding: `px-4 sm:px-6`
- Header height: `h-14 sm:h-16`
- Desktop action button gap: `gap-2` (from `gap-3`)
- Mobile menu padding: `px-4 py-3 sm:px-6 sm:py-4`

---

## 4. How It Works Redesign

**File:** `components/marketing/how-it-works.tsx`

### Architecture
Complete rewrite of the interaction model while preserving the Fund → Convert → Hold → Spend narrative.

**Desktop:**
- Horizontal timeline with 2px track and gold gradient progress fill
- 14×14 step nodes with glow ring and ripple animation on active
- ARIA tablist/tab/tabpanel semantics with keyboard navigation (arrow keys)
- Detail panel with staggered content entrance (icon, step label, headline, description)
- Auto-cycling progress bar inside detail card (linear fill over 5s)
- Steps: Fund (emerald), Convert (gold), Hold (cyan), Spend & Invest (gold)
- M-Pesa rail badge in Fund step detail

**Mobile:**
- Vertical accordion-style step cards (not just dots)
- Each card shows icon + step number + title — always visible
- Active card expands to reveal headline, description, and M-Pesa badge
- `AnimatePresence` height animation for smooth expand/collapse
- Touch-friendly 44px hit targets
- Progress bar inside expanded card

**Motion:**
- `ease: [0.32, 0.72, 0, 1]` custom bezier for premium feel
- Scale pulse on active node (2s infinite)
- Gold glow + ripple ring on active (2s infinite cycle)
- Staggered entrance delays on detail content (0.1→0.25s)
- Tab panel slide: `y: 20` → `y: 0` enter, `y: -16` exit

**Behavior:**
- Auto-cycles every 5 seconds
- User interaction pauses for 10 seconds, then resumes
- Pause timer properly cleared on re-interaction (ref-based)
- Keyboard: ArrowRight/ArrowDown advances, ArrowLeft/ArrowUp goes back

---

## 5. Footer Social Icons

**File:** `components/marketing/site-footer.tsx`

### Problem
"Connect" column used plain text links for Twitter/X, Discord, GitHub, Email.

### Fix
- Removed "Connect" text column
- Added social icon row below the brand tagline
- Icons: X (`SiX`), Discord (`SiDiscord`), GitHub (`SiGithub`), Email (`Mail` from Lucide)
- Each icon in a 36×36 rounded-lg container with glassmorphic background
- States: `text-white-40` default → `text-white-80` hover, border brightens
- `focus-visible:ring-1 ring-gold/40` for keyboard accessibility
- `aria-label` on every link
- Brand column expanded to `lg:col-span-2` to fill the space

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/web/components/marketing/mpesa-icon.tsx` | Local M-Pesa SVG brand mark |

## Files Modified

| File | Changes |
|------|---------|
| `components/marketing/asset-icons.tsx` | Token icons via @web3icons, brand icons via @icons-pack, M-Pesa re-export |
| `components/marketing/site-header.tsx` | Scroll shadow fix, mobile spacing tightened |
| `components/marketing/site-footer.tsx` | Social icon row with branded icons |
| `components/marketing/how-it-works.tsx` | Full redesign with timeline, ARIA, keyboard nav |
| `package.json` | Added @web3icons/react, @icons-pack/react-simple-icons |

## Dependencies Added

| Package | Version | Size impact |
|---------|---------|-------------|
| `@web3icons/react` | ^3.4.0 | Tree-shakes to 3 token icons |
| `@icons-pack/react-simple-icons` | ^13.12.0 | Barrel import — 5 icons used |

## Remaining Limitations

- `@icons-pack/react-simple-icons` individual icon imports (`./icons/SiX`) fail with Next.js — must use barrel import, which may include more code in the bundle than ideal. Tree-shaking should mitigate this.
- Microsoft and SPY stock icons remain custom SVG — no clean brand mark available in simple-icons.
- USD and KES fiat icons remain custom SVG — no standard icon library covers fiat currency marks.
- M-Pesa icon is an approximation of the brand mark, not official artwork.
