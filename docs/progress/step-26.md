# Step 26 — Frontend Polish Sweep: Ribbon Fix, Motion Upgrade, Section Differentiation

**Date:** 2026-04-09
**Agent:** Sitri (UX/UI Head)
**Scope:** SSE reconnection, hero performance, swap widget loading state, TrustStrip redesign, premium motion system, section differentiation

---

## What Existed Before

- **SSE EventSource** had zero reconnection logic — when the connection dropped (network blip, server restart, Vercel edge timeout), the price ribbon froze at stale values with no recovery
- **Hero section** used `useLiveRate` which triggered React state updates on every SSE message (~5-10s), re-rendering the entire hero including all Framer Motion animations
- **Guest swap widget** showed empty fields when rates weren't connected — looked broken, not "loading"
- **TrustStrip** duplicated ProductPillars content (same 5 features: multi-currency, conversion, cards, investing, security) with nearly identical visual treatment
- **Motion system** had basic FadeUp/StaggerContainer/StaggerItem — all sections used the same y:20→0 entrance, creating monotonous scroll rhythm
- **Section backgrounds** used static ambient glows — no breathing or living quality
- **Market ribbon** had no edge fade masks — prices appeared and disappeared abruptly at viewport edges

## What Was Changed

### 1. SSE Reconnection with Exponential Backoff (`lib/api/rates.ts`)

- Added `onerror` handler to EventSource that tears down the broken connection
- Reconnect schedules with exponential backoff: 1s → 2s → 4s → ... max 30s
- Backoff resets on successful `onopen`
- Only reconnects if listeners still exist (ref-counting preserved)
- Extracted `destroyStream()` for clean shared teardown

### 2. Hero Rate Display — DOM-Patched Ref (`lib/hooks/use-realtime-rates.ts`, `hero-section.tsx`)

- Added `useLiveRateRef()` hook: subscribes to SSE, patches a DOM element directly, zero React re-renders
- Hero section now uses `ref={btcKesRef}` on the rate span instead of `{btcKesDisplay}` interpolation
- Eliminates full HeroSection re-renders on every rate tick

### 3. Swap Widget Loading State (`guest-swap-widget.tsx`)

- When `rateDisplay` is empty (SSE not connected), shows "Connecting to live rates…" with a pulsing gold dot
- When connected, shows the rate as before

### 4. TrustStrip Redesign (`trust-strip.tsx`)

Complete rewrite from 5 feature cards (duplicating ProductPillars) to a compact credibility bar:
- **Animated counters** (currencies supported, uptime SLA, avg settlement, encryption standard) with eased-out cubic interpolation triggered on scroll into view
- **Trust signals strip** (Kenya-based & regulated, end-to-end encrypted, 24/7 monitoring, KYC compliant, fraud-protected)
- Visually distinct: compact, factual, no card treatment — breaks the pattern before ProductPillars

### 5. Motion System Upgrade (`motion-wrapper.tsx`)

New primitives added:
- **`ParallaxDrift`** — scroll-linked subtle vertical drift (configurable intensity)
- **`Float`** — continuous gentle floating animation with configurable amplitude/duration/delay
- **`ScaleReveal`** — entrance from 0.92 scale with custom easing
- **`GlowPulse`** — breathing pulsing glow effect for ambient backgrounds

### 6. SectionShell Parallax (`section-shell.tsx`)

- Added `useScroll` + `useTransform` for subtle 20px parallax drift on inner content
- Sections now have gentle vertical motion as user scrolls, creating premium scroll rhythm
- Entrance animation simplified to opacity-only (parallax handles the movement)

### 7. Section Differentiation

- **ProductPillars**: Added breathing `GlowPulse` behind section heading
- **SecuritySection**: Added cyan-tinted `GlowPulse` (visually distinct from gold-tinted other sections)
- **GlobalFinanceSection**: Replaced static ambient glow with breathing `GlowPulse`
- **FinalCTA**: Replaced static radial gradients with breathing `GlowPulse` (gold + cyan)
- **Hero ambient rings**: Changed from static borders to breathing motion (opacity + scale animation)
- **Market ribbon**: Added edge fade masks (gradient from cell color to transparent) for premium ticker appearance

## Build Verification

```
✓ Compiled successfully in 12.1s
✓ Finished TypeScript in 12.0s
✓ Generating static pages (8/8) in 778ms
NX Successfully ran target build for project web (33s)
```

## Files Changed

| File | Change |
|------|--------|
| `apps/web/lib/api/rates.ts` | SSE reconnection with exponential backoff |
| `apps/web/lib/hooks/use-realtime-rates.ts` | Added `useLiveRateRef` hook |
| `apps/web/components/marketing/hero-section.tsx` | DOM-patched rate, breathing ambient rings |
| `apps/web/components/marketing/guest-swap-widget.tsx` | Loading state for disconnected rates |
| `apps/web/components/marketing/trust-strip.tsx` | Full rewrite: credibility bar with animated counters |
| `apps/web/components/marketing/motion-wrapper.tsx` | Added ParallaxDrift, Float, ScaleReveal, GlowPulse |
| `apps/web/components/marketing/section-shell.tsx` | Scroll-linked parallax drift |
| `apps/web/components/marketing/product-pillars.tsx` | Breathing glow behind heading |
| `apps/web/components/marketing/security-section.tsx` | Cyan breathing glow behind heading |
| `apps/web/components/marketing/global-finance-section.tsx` | Breathing glow on visual side |
| `apps/web/components/marketing/final-cta.tsx` | Breathing ambient glows |
| `apps/web/components/marketing/market-ribbon.tsx` | Edge fade masks |
