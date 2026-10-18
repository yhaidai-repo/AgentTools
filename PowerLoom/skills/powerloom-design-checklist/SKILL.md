---
name: powerloom-design-checklist
description: How the PowerLoom design agent writes an implementation design: plan, alternatives, risks, tests and estimates (record_estimate). Use when starting a design task, before calling write_design.
---

# Design checklist

## Before designing
- Restate the PBI's goal and its acceptance criteria in a few lines; the plan must cover each criterion.
- Read the code research pointed to; confirm it still says what the result claims.
- List what you still don't know. For each: does it change the plan? Yes → gap. No → assumption.
- Root cause confirmed (config, infra or a broken pipeline) → the first plan is "fix the root cause only". Trace what the existing flow does after that fix; each extra step names the symptom left, with evidence.
- Runtime assumptions (startup code runs, lag, missing data) are checked in code, or become a gap.

## Bugs of a PBI (child items)
- Design only the fix, on top of the parent's design in `<parent-pbi>`; it is implemented on the parent's branch. No re-design, no new branch.
- Name the parent's plan step each fix step amends; tests cover the bug's reproduction and the parent's criteria it touches.

## Approach and alternatives
- Prefer extending what exists (helpers, base classes, patterns in the same repo) over new code.
- Weigh alternatives only when the choice is real: placement, pattern, data model, library, sync vs async.
- Per alternative: pros, cons, and the one reason it lost.

## Plan
- One step = one coherent change a reviewer can check: repo, files + symbols, what changes.
- Order by dependency: schema/contracts first, then logic, then UI/config, then cleanup.
- Mark a step `agent_doable: false` when it needs access, a decision or work outside the repos (deploy, config in a portal, data fix).

## Risks
- Think: data migration, backwards compatibility, concurrency, performance, security, other consumers of a changed contract.
- Each risk gets a mitigation that is a concrete action (test, flag, migration step), not "be careful".

## Rollout effects
- What switching the fix on does to existing data, projections and counters, incl. earlier backfills or migrations that set them.
- A backfill or any change to historic data only with the user's OK: ask it as a question, not an assumption.
- Post-deploy checks: data rules to verify after the deploy, each with its query (e.g. no negative counters).

## Tests
- One case per acceptance criterion at least, plus edge cases and each risk's check.
- unit = one class/function; integration = DB, queue, API or several components; manual = UI or environment only.

## Estimates
- Given with `record_estimate`, always both values; optional for design (skip it when the PBI's latest estimate still holds).
- Human h: a developer who knows the stack, without an agent, incl. tests and review fixes.
- Agent h: an agent implementing the plan, incl. running tests; excluding waiting for review.
- Complexity: 1 trivial, 2 small and local, 3 several files or one contract, 4 several components or a migration, 5 cross-system or unclear.
- Confidence: high = every step verified in code; medium = some steps inferred; low = key parts assumed.
- Basis: the 2–3 things that drive the numbers.
