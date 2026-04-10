# Step 25 — Sitri Agent: Prompt Suite And Ambiguity Defaults

**Date:** 2026-04-09  
**Scope:** Add dedicated prompt entry points for Sitri and tighten how the agent chooses a response mode when user intent is broad or ambiguous.

---

## What Existed Before

- Sitri had a stronger internal output contract after Step 24, but there were no dedicated workspace prompts for the most common frontend leadership tasks
- Users still had to know how to phrase an audit or PostHog planning request manually
- Ambiguous requests could still drift between audit, proposal, implementation, or instrumentation unless the user was very explicit

## What Was Added

Added two workspace prompts in `.github/prompts/`:

- `frontend-audit.prompt.md` for Sitri's full frontend leadership audit flow
- `posthog-plan.prompt.md` for Sitri's PostHog and instrumentation planning flow

Updated `.github/agents/sitri.agent.md` with a new `Ambiguity Defaults` section that tells Sitri how to choose a mode when user intent is not perfectly specified.

## Why This Refinement Matters

These changes make Sitri easier to invoke correctly and harder to misuse.

- The new prompts give users stable entry points for the two highest-value non-implementation tasks: frontend audits and analytics planning
- The ambiguity rules reduce the chance that broad UX asks turn into premature implementation or that instrumentation work skips taxonomy design
- Together, the prompts and the defaults make Sitri more predictable as a frontend leadership agent rather than only a descriptive persona

## Design Decisions

- **Prompts, not skills:** these are focused single-task entry points, so `.prompt.md` files are the right primitive instead of heavier skills
- **Prompt tools are intentionally limited:** the prompts use `read`, `search`, `web`, and `todo` so the default behavior stays analytical rather than implementation-first
- **Audit-first bias for ambiguity:** broad or strategic frontend requests now default to audit mode instead of code changes
- **Instrumentation-first bias for analytics asks:** any PostHog or funnel request now starts with taxonomy and measurement design before wiring

## Files Changed

| File | Change |
|------|--------|
| `.github/prompts/frontend-audit.prompt.md` | Added a dedicated Sitri frontend audit prompt |
| `.github/prompts/posthog-plan.prompt.md` | Added a dedicated Sitri PostHog planning prompt |
| `.github/agents/sitri.agent.md` | Added ambiguity default rules for mode selection |
| `tasks/todo.md` | Recorded the prompt/default refinement task |
| `docs/progress/step-25.md` | Documented the refinement and rationale |

## Verification

- Confirmed `.github/prompts/` was not already populated with overlapping prompt files
- Kept both prompts aligned with Sitri's output contract from Step 24
- Preserved implementation work as an explicit follow-up instead of the default path for audit and instrumentation prompts