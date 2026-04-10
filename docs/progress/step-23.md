# Step 23 — Sitri Agent: UX/UI Head Workspace Agent

**Date:** 2026-04-09  
**Scope:** Create a dedicated workspace agent for Koya frontend leadership, UX audits, component governance, and PostHog instrumentation planning.

---

## What Existed Before

- The repo already had two workspace agents: `demon` for hands-on engineering and `koya` for broader product and engineering assistance
- There was no dedicated frontend leadership agent focused on UX architecture, design consistency, sensitive financial flows, and analytics governance
- The UX/UI Head charter existed as a standalone note in `sitri.md`, but not as a discoverable `.agent.md` file

## What Was Added

Created `.github/agents/sitri.agent.md` as a workspace agent with:

- A keyword-rich description for agent-picker discovery and subagent routing
- A focused toolset: `read`, `edit`, `search`, `execute`, `web`, `todo`, and `agent`
- Explicit role boundaries centered on frontend UX, visual quality, accessibility, performance, component strategy, and PostHog instrumentation
- Guardrails for financial-product UX, dependency discipline, and sensitive-route conservatism
- Required-reading guidance that points the agent at Koya's current design tokens, deploy model, and recent frontend delivery decisions

## Why This Agent Exists

Koya's existing agents cover implementation breadth, but they do not strongly encode frontend leadership behavior. Sitri fills that gap by:

- Raising the decision bar on conversion UX and trust-sensitive flows
- Making design-system and component-governance work a first-class responsibility
- Keeping frontend analytics and event taxonomy tied to UX outcomes instead of bolted on later
- Preserving brand consistency within the existing Next.js, Tailwind, Radix, and Framer Motion stack

## Design Decisions

- **Workspace scope, not user scope:** the agent lives in `.github/agents/` because the charter is Koya-specific and should be available to the repo, not only one profile
- **Implementation-capable toolset:** Sitri can audit and also execute frontend improvements, including verification commands
- **Selective external research:** Sitri can use web tools for vendor docs and analytics/frontend research when repo context is not enough
- **Focused subagent access:** Sitri can delegate to `demon`, `koya`, or `Explore` when backend work or deeper exploration is needed without diluting its own role
- **No model pinning:** the agent uses the active picker/default model rather than hard-coding a specific model in frontmatter

## Files Changed

| File | Change |
|------|--------|
| `.github/agents/sitri.agent.md` | Added the new Sitri workspace agent |
| `tasks/todo.md` | Recorded the plan and completion for the Sitri agent task |
| `docs/progress/step-23.md` | Documented the creation and purpose of the new agent |

## Verification

- Confirmed `.github/agents/` already exists and is the established location for Koya workspace agents
- Reviewed existing agent patterns in `.github/agents/demon.agent.md` and `.github/agents/koya.agent.md`
- Matched the new file to the documented `.agent.md` frontmatter and body conventions from the Copilot custom-agents reference

## Open Points

The current draft leaves one likely follow-up for future refinement:

- Whether Sitri should eventually require a stricter output template for audits and implementation plans