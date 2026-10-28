---
name: powerloom-planning-checklist
description: "How the PowerLoom planning agent plans a PBI with GSD: answering GSD's questions from evidence, telling assumptions from blockers, checking the plan, write_plan, the review hand-off and estimates (record_estimate). Use when starting a planning task, before the first GSD command."
---

# Planning checklist

## Before GSD runs
- Restate the PBI's goal and its acceptance criteria in a few lines; the plan must cover each criterion as a requirement.
- Read the research results' code and docs locations yourself; confirm they still say what the result claims.
- List what you still don't know. For each: does the result depend on it? Yes → question. No → assumption.
- Root cause confirmed (config, infra or a broken pipeline) → the first phase is "fix the root cause only". Each extra phase names the symptom left, with evidence.

## Bugs of a PBI (child items)
- Plan only the fix, on top of the parent's plan in `<parent-pbi>`, on the parent's branch. No re-plan of the parent.
- Name the parent's plan or task each fix amends; the tests cover the bug's reproduction and the parent's criteria it touches.

## Answering GSD
- `--assumptions` first: each assumption gets a source (PBI, answer, doc, file and symbol) or becomes a question or an assumption you list.
- After `--auto`: read the phase's DISCUSSION-LOG.md. Each `[auto]` choice is one GSD took without anyone; keep it only with evidence or when it is a style default.
- Style default (keep, list as assumption): naming, file placement, test layout, log wording, the repo's usual pattern.
- Blocker (question, intent ask): business rules, limits and thresholds, data shapes from outside the repo, other teams' contracts, scope cuts, a backfill or any change to historic data.
- One question per fact, with the options and GSD's recommendation; never a question `<existing-items>` already answers.

## Checking the plan
- Every requirement in REQUIREMENTS.md is covered by a plan (`planning inspect`, or write_plan's "Not covered" line).
- Waves: plans in one wave touch different files; a plan that needs another's output is in a later wave.
- Each task names real files and symbols you or GSD read; a task nobody verified is an assumption.
- Prefer extending what exists (helpers, base classes, patterns in the same repo) over new code.
- The checker's last return is recorded as is; open issues go into the review package, never hidden.

## Risks and rollout
- Think: data migration, backwards compatibility, concurrency, performance, security, other consumers of a changed contract.
- Each risk in the plans' threat register gets a concrete mitigation (test, flag, migration step), not "be careful".
- What switching the change on does to existing data, projections and counters; post-deploy checks with their query.

## Tests
- One check per acceptance criterion at least, plus edge cases and each risk's check, in the plans' `<verification>`.

## Review hand-off
- Gate approve, to a person, no steps: the answers are fixed (approve | changes; ok | corrections).
- The package lists: what the plan does, the `[auto]` decisions, the assumptions to check, the checker's verdict, the plan's ref `PBI-<id>:plan`.
- Then the implementation hand-off to `implement` with `depends_on: ["new:1"]`.

## Estimates
- Given with `record_estimate`, always both values; optional for planning (skip it when the PBI's latest estimate still holds).
- Human h: a developer who knows the stack, without an agent, incl. tests and review fixes.
- Agent h: an agent executing the plan, incl. running tests; excluding waiting for review.
- Complexity: 1 trivial, 2 small and local, 3 several files or one contract, 4 several components or a migration, 5 cross-system or unclear.
- Confidence: high = every task verified in code; medium = some tasks inferred; low = key parts assumed.
- Basis: the 2–3 things that drive the numbers.
