# Step 24 — Sitri Agent: Output Contract Refinement

**Date:** 2026-04-09  
**Scope:** Tighten the Sitri workspace agent so audits, implementation plans, library decisions, and PostHog work follow an explicit, repeatable output structure.

---

## What Existed Before

- Sitri already had strong role guidance, tool boundaries, and frontend product standards
- The agent described what it should care about, but not a strict response contract for different kinds of work
- The remaining open point from Step 23 was whether Sitri should enforce a stronger audit and implementation template

## What Was Added

Updated `.github/agents/sitri.agent.md` with a new `Required Output Contract` section that defines five response modes:

- **Frontend leadership audit mode** for full UX/design reviews
- **UI improvement proposal mode** for scoped recommendations before implementation
- **Implementation mode** for code or documentation changes
- **Library decision mode** for dependency evaluation
- **Instrumentation mode** for PostHog planning and review

Each mode now has:

- A required section order
- Scope rules to keep responses concrete
- Constraints that reflect Koya's current stack, sensitive financial flows, and analytics discipline

## Why This Refinement Matters

The original Sitri draft encoded judgment, but not enough delivery shape. That left too much room for responses that were directionally good but structurally inconsistent.

The refinement raises the floor by making Sitri:

- Return the full nine-part audit requested in the original charter when asked for a frontend leadership audit
- Separate proposals from implementations so planning quality does not get skipped
- Evaluate dependencies through a fixed governance lens instead of ad hoc preference
- Treat PostHog work as a first-class frontend concern with explicit privacy guardrails

## Design Decisions

- **Mode-based contract instead of one universal template:** the agent needs different output shapes for audits, implementation, dependency review, and instrumentation work
- **Stricter first:** when a request spans multiple categories, Sitri should start with the stricter structure and then continue into action
- **Concrete over aesthetic language:** the templates push the agent toward ranked issues, acceptance criteria, measurable outcomes, and verification details

## Files Changed

| File | Change |
|------|--------|
| `.github/agents/sitri.agent.md` | Added a required output contract with five explicit response modes |
| `tasks/todo.md` | Recorded the Sitri refinement task |
| `docs/progress/step-24.md` | Documented the refinement and rationale |

## Verification

- Confirmed the updated `.agent.md` file still has valid frontmatter and no editor-detected errors
- Checked that the new contract resolves the open follow-up left in Step 23
- Kept the refinement inside the existing Sitri agent rather than introducing a second overlapping frontend agent