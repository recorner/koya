# Copilot Instructions — Koya Monorepo

These instructions apply to **all** Copilot interactions in this workspace.

## Planning & Workflow

- Enter plan mode for any non-trivial task (3+ steps or architectural decisions). Write the plan to `tasks/todo.md` with checkable items before starting implementation.
- If something goes sideways, STOP and re-plan immediately — don't keep pushing a broken approach.
- Use subagents liberally: offload research, exploration, and parallel analysis to keep the main context clean.

## Task Tracking

1. Write plan to `tasks/todo.md` with checkable items.
2. Mark items complete as you go.
3. Provide a high-level summary at each step.
4. After the task is done, update `docs/progress/` with a step file (e.g., `docs/progress/step-12.md`).
5. After any correction from the user, update `tasks/lessons.md` with the pattern so the mistake is never repeated.

## Verification

- Never mark a task complete without proving it works — run tests, check logs, demonstrate correctness.
- Ask: "Would a staff engineer approve this?"
- Diff behavior between `main` and your changes when relevant.

## Code Quality

- **Simplicity first.** Make every change as simple as possible. Impact minimal code.
- **No laziness.** Find root causes. No temporary fixes. Senior developer standards.
- **Minimal impact.** Changes should only touch what's necessary. Avoid introducing bugs.
- For non-trivial changes, pause and ask "is there a more elegant way?" before finalizing.
- Skip over-engineering for simple, obvious fixes.

## Bug Fixing

- When given a bug report: just fix it autonomously. Don't ask for hand-holding.
- Point at logs, errors, failing tests — then resolve them.
- Fix failing CI tests without being told how.

## Self-Improvement

- After ANY correction from the user: immediately update `tasks/lessons.md` with the pattern and a rule to prevent the same mistake.
- Review `tasks/lessons.md` at the start of each session.
