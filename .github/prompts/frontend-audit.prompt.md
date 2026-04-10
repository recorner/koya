---
name: "Koya Frontend Audit"
description: "Run Sitri's full frontend leadership audit for a Koya route, flow, design system area, or the whole web app."
agent: "Sitri"
argument-hint: "Area to audit. Example: /convert flow, landing page, shared UI components, overview dashboard"
tools: [read, search, web, todo]
---

Run Sitri's **Frontend leadership audit mode** for the requested Koya surface.

Before producing the audit:
- Read the relevant source files first
- Review the current design tokens, route structure, and component patterns
- Use web research only when the repo does not answer a framework, accessibility, or analytics question

Return the audit in this exact structure:

1. Current frontend architecture summary
2. Current brand/design system summary
3. Top UX issues
4. Top visual/design consistency issues
5. Recommended component strategy
6. Recommended library policy
7. PostHog implementation plan
8. Highest-impact first UI sweep
9. Prioritized backlog for the next 3 frontend iterations

Audit requirements:
- Rank issues by impact and explain why they matter
- Separate public-page findings from sensitive-flow findings when relevant
- Tie recommendations to Koya's current stack, brand system, and route sensitivity
- Include concrete success metrics
- Do not implement changes unless the user explicitly asks for implementation after the audit