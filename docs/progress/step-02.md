# Step 02 — Landing Page Refinement Pass

**Status:** Complete  
**Date:** 2026-03-10

---

## Scope

Refinement pass over the existing Koya landing page. Five targeted improvements — no rebuild, no backend changes, no re-initialization.

---

## 1. Live Market Ribbon Ticker

**File:** `apps/web/components/marketing/market-ribbon.tsx`

### What changed
- Replaced the static centered flex row with a **continuously scrolling horizontal ticker** (right → left).
- Uses the CSS `ticker-scroll` keyframe animation with a duplicated DOM pattern for seamless infinite looping.
- Animation pauses on hover via CSS `group-hover:[animation-play-state:paused]`.
- Added **real asset icons** (BTC, USDC, USDT, KES, USD) next to each pair label via `AssetIcon`.
- Expanded from 5 instruments to 8 (added USDC/KES, USDT/KES, USDT/USD).
- Ticker data moved to `asset-metadata.ts` for clean separation and future API integration.
- Container uses `overflow-hidden` — eliminates any horizontal bleed on mobile.

### Keyframe added to `globals.css`
```css
@keyframes ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

---

## 2. Guest Swap / Convert Widget

**File:** `apps/web/components/marketing/guest-swap-widget.tsx`

### Architecture
Cleanly separated into three concerns within the component file:

1. **`useSwapState()` hook** — manages source/dest asset selection, amount input, computed destination amount, rate display, and direction swapping. Uses `ASSETS` and `MOCK_RATES` from `asset-metadata.ts`.

2. **`AssetSelector` component** — lightweight dropdown with AnimatePresence open/close animation. Shows asset icon + symbol + name. KES entries include a small M-Pesa rail indicator.

3. **`GuestSwapWidget` component** — the rendered surface:
   - Glass card container using existing `glass` utility class
   - "Convert" header + "Guest Preview" badge
   - Source panel: asset selector + amount input (monospace), "You pay" label
   - Animated swap direction toggle (framer-motion rotation)
   - Destination panel: asset selector + computed amount, "You receive" label
   - Rate display line (e.g. `1 BTC ≈ 11,352,978 KES`)
   - Gold CTA button: "Get Started to Convert" (disabled until amount entered)
   - Disclaimer text about indicative rates

### Supported conversions
KES ↔ USD, KES ↔ BTC, KES ↔ USDC, KES ↔ USDT, BTC ↔ USD, USDC ↔ USD, USDT ↔ USD, and all reverse directions.

### Placement on page
Positioned between `HeroSection` and `TrustStrip` in its own section with heading "Convert instantly" and descriptive subtext.

---

## 3. Real Asset / Brand Icons

**File:** `apps/web/components/marketing/asset-icons.tsx`

### Icons created
- **Crypto:** BTC (Bitcoin orange circle + ₿ path), USDC (blue circle + $ mark), USDT (teal circle + ₮ mark)
- **Fiat:** USD (green circle + $), KES (emerald circle + KSh)
- **Rails:** M-Pesa (green circle + M)
- **Stocks:** Apple (dark circle + apple path), Tesla (red circle + T path), Microsoft (blue circle + 4-color grid), SPY (navy circle + chart line)

### Usage
- `AssetIcon` lookup component — renders by symbol string
- `StockIcon` lookup component — renders by stock symbol string
- Used in: market ribbon ticker, swap widget asset selectors, global finance section stock tickers

### Integration points
- `market-ribbon.tsx` — asset icons next to pair labels
- `guest-swap-widget.tsx` — asset icons in selectors + M-Pesa rail indicator
- `global-finance-section.tsx` — replaced generic text badges with real `StockIcon` components
- `how-it-works.tsx` — M-Pesa icon in the "Fund" step detail panel

---

## 4. How It Works — Motion Redesign

**File:** `apps/web/components/marketing/how-it-works.tsx`

### What changed
Replaced the static 4-column grid with an **interactive auto-cycling timeline**:

**Desktop layout:**
- Horizontal timeline track with 4 clickable step nodes
- Active node gets gold glow, scale pulse animation, and ripple ring effect
- Progress line fills between nodes using framer-motion animated width
- Below: animated detail panel with `AnimatePresence mode="wait"` — fades/slides between steps
- Detail cards have gradient accent backgrounds per step
- Icons per step: Wallet (Fund), ArrowLeftRight (Convert), ShieldCheck (Hold), CreditCard (Spend)
- M-Pesa icon shown as "Supported rail" in the Fund step

**Mobile layout:**
- Horizontal dot indicators with animated width (active = wider pill)
- Step labels under each dot
- Detail card below with horizontal slide transitions (enter from right, exit to left)

**Behavior:**
- Auto-cycles every 4.5 seconds
- Clicking a step selects it and pauses auto-cycling for 9 seconds, then resumes
- Smooth transitions between all steps

---

## 5. Mobile Responsiveness Fixes

### Issues fixed

1. **Cards section overflow:** Fixed-width card elements `w-[350px]` / `w-[380px]` caused overflow on screens < 380px. Changed to `w-full max-w-[350px]` / `max-w-[380px]` with `sm:` breakpoint variants.

2. **Virtual card offset:** Same responsive width fix applied to the offset background card element.

3. **Market ribbon:** New ticker implementation uses `overflow-hidden` on the container — prevents any horizontal scroll from ticker content.

4. **Page wrapper:** Added `overflow-x-hidden` to the `<main>` element in `page.tsx`.

5. **Layout wrapper:** Added `overflow-x-hidden` to the content wrapper div in `(public)/layout.tsx`.

---

## Asset Metadata Infrastructure

**File:** `apps/web/components/marketing/asset-metadata.ts`

Created a central asset data file to support the swap widget, ticker, and stock section:

- `Asset` type with `symbol`, `name`, `type`, `color`, `glyph` fields
- `ASSETS` registry (KES, USD, BTC, USDC, USDT)
- `ASSET_LIST` for iteration
- `MOCK_RATES` — indicative exchange rates between all supported pairs
- `TICKER_INSTRUMENTS` — market ribbon ticker data (8 pairs)
- `STOCK_TICKERS` — global finance section stock data (AAPL, TSLA, SPY, MSFT)

All data is structured to be cleanly replaceable with real API data in the future.

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/web/components/marketing/asset-metadata.ts` | Asset types, registry, mock rates, ticker data |
| `apps/web/components/marketing/asset-icons.tsx` | SVG icon components for assets, rails, stocks |
| `apps/web/components/marketing/guest-swap-widget.tsx` | Guest conversion/swap surface |

## Files Modified

| File | Changes |
|------|---------|
| `apps/web/components/marketing/market-ribbon.tsx` | Live scrolling ticker with icons |
| `apps/web/components/marketing/how-it-works.tsx` | Interactive timeline with motion |
| `apps/web/components/marketing/global-finance-section.tsx` | Real stock icons |
| `apps/web/components/marketing/cards-section.tsx` | Responsive card widths |
| `apps/web/app/(public)/page.tsx` | Swap widget section, overflow-x-hidden |
| `apps/web/app/(public)/layout.tsx` | overflow-x-hidden on wrapper |
| `apps/web/app/globals.css` | ticker-scroll keyframe animation |

---

## Assumptions & Placeholders

- Exchange rates are hardcoded mock values for display purposes only
- Stock prices are illustrative static values
- Swap widget does not execute actual conversions — it's a guest preview surface
- Asset icons are simplified SVG marks, not official brand assets
- M-Pesa is shown as a payment rail indicator, not a currency
- The swap widget uses a custom dropdown, not a full Radix Select — appropriate for a marketing surface

## Remaining Limitations

- No real-time data feed connected to the ticker or swap widget
- Swap widget doesn't persist state or connect to backend conversion API
- Stock icon SVGs are approximations of brand marks — should be verified for trademark compliance if used in production
- How It Works auto-cycle timer is client-side only — no server-side awareness
- Asset selector dropdown doesn't have keyboard navigation (acceptable for marketing page)

## Design Preservation

All changes maintain:
- Dark-first premium aesthetic (vault-black, navy backgrounds)
- Glassmorphism effects (glass utility class on swap widget)
- 24K gold accent system (node highlights, CTA buttons, badges)
- Syne / DM Sans / JetBrains Mono typography (display, body, financial data)
- Restrained color usage (green/red only for financial signals)
- Premium calm financial tone throughout
