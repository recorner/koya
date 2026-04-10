---
name: "Koya PostHog Plan"
description: "Plan or review PostHog instrumentation for a Koya route, funnel, or frontend flow using Sitri's instrumentation mode."
agent: "Sitri"
argument-hint: "Flow to instrument. Example: guest conversion funnel, landing CTA to quote, login and overview"
tools: [read, search, web, todo]
---

Run Sitri's **Instrumentation mode** for the requested Koya flow or funnel.

Before producing the plan:
- Read the relevant frontend routes, components, and current docs first
- Look for any existing analytics or event naming conventions in the repo
- Use web research only when vendor documentation or implementation guidance is required

Return the result in this exact structure:

1. Goal or funnel being measured
2. Event taxonomy
3. Event properties
4. Sensitive-data exclusions
5. Wiring plan
6. Verification plan
7. Success metric or dashboard outcome

Instrumentation requirements:
- Use stable event names tied to real product steps, not generic clicks
- Do not log secrets, raw identity payloads, wallet addresses unless strictly necessary, or unnecessary PII
- Call out where event boundaries should align to quote, identity, payout, payment, status, and completion states
- If the request implies feature flags or experiments, note readiness separately without mixing it into the core event taxonomy
- Do not implement instrumentation unless the user explicitly asks for implementation after the plan