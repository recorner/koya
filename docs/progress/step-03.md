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

## 4. How It Works Redesign (v2 — Product Data Pass)

**File:** `components/marketing/how-it-works.tsx`

### Architecture
Complete rewrite replacing design-commentary placeholder copy with real Koya product data. Simplified layout, smoother motion, ARIA-accessible, color-coded steps.

**Layout:**
- Desktop: horizontal timeline with 2px track + gold gradient fill, then a full-width detail panel below
- Mobile: horizontal pill tabs (scrollable) with a progress bar, then the same detail panel
- Detail panel: two-column on desktop (main content left, metric sidebar right), single-column on mobile

**Step Content (real product data):**

| Step | Title | Headline | Color | Key stat |
|------|-------|----------|-------|----------|
| 01 | Fund | Deposit in seconds, not days | Emerald | < 3 min avg. deposit |
| 02 | Convert | Any asset to any asset. Transparent rates. | Gold | 30 sec quote lock |
| 03 | Hold | Five wallets. One unified vault. | Cyan | 5 synced wallets |
| 04 | Spend | Turn any balance into real-world action | Gold | 180+ countries |

**Per-step features:**
- **Fund:** M-Pesa STK push, auto-detect crypto deposits, guided KYC tiers. Badges: M-Pesa, KES, BTC.
- **Convert:** 30-second locked quotes, full conversion path visibility, all 20 asset pairs. Badges: KES, USD, BTC, USDC, USDT.
- **Hold:** Segregated per-currency wallets, portfolio dashboard, institutional custody. Badges: all 5 currencies.
- **Spend:** Instant virtual cards (Visa), cross-border bank/mobile transfers, fractional US stocks (AAPL, etc). No badges (action-oriented step).

**Desktop timeline:**
- 2px track with gold gradient fill animating between nodes
- 44px circular step nodes with icon, labeled below
- Active node pulses with a ripple ring (2s infinite, step-colored)
- Past nodes show emerald checkmark
- ARIA tablist/tab/tabpanel semantics with full keyboard nav (arrow keys)

**Mobile:**
- Horizontal scrollable pill buttons (step number + title)
- Active pill uses step color (emerald/gold/cyan)
- Gold gradient progress bar below

**Detail panel:**
- Left: step icon + eyebrow + headline (font-display) + description + staggered bullet features + currency badges
- Right sidebar: primary stat (font-mono, 3xl), detail card, "Next step" button with arrow
- Ambient glow behind panel keyed to step color

**Motion (smoother):**
- `ease: [0.32, 0.72, 0, 1]` custom cubic-bezier on all transitions
- Panel entrance: `y: 20 → 0` (0.4s), exit: `y: -16` (0.4s)
- Bullets stagger in: `x: -12 → 0`, 0.08s apart
- Currency badges scale in: `0.85 → 1`, 0.06s apart
- Timeline fill: 0.5s smooth width animation
- Active node ripple: `scale: [1, 1.4, 1]`, `opacity: [0.5, 0, 0.5]` (2s loop)

**Behavior:**
- Auto-cycles every 5 seconds
- User interaction pauses for 10 seconds, then resumes
- Pause timer properly cleared on re-interaction (ref-based)
- Keyboard: ArrowRight/ArrowDown advances, ArrowLeft/ArrowUp goes back

**What changed from v1:**
- All meta/design-commentary copy replaced with real product messaging
- Removed dev-facing controls (prev/next buttons, auto-play toggle)
- Removed "Attention anchor" sidebar — replaced with stat + detail cards
- Added currency icon badges (M-Pesa, KES, USD, BTC, USDC, USDT)
- Color-coded steps: Fund (emerald), Convert (gold), Hold (cyan), Spend (gold)
- Separated mobile/desktop navigation (pills vs timeline)
- Smoother ease curve throughout

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
