---
name: powerloom-implementation-checklist
description: "How the PowerLoom implementation agent builds an approved plan with GSD: the review outcome first, execute-phase per phase, builds and tests in the sandbox, checkpoints, answering verify-work, the hand-over to a person (branch, worktree, pull request description, open UAT items) and never pushing. Use when starting an implementation task, before the first GSD command."
---

# Implementation checklist

## Before GSD runs
- Read `<implementation>`: only `outcome="approved"` builds. Replan: hand the changes to `design` as written, nothing else. Blocked: write the reason and stop.
- Read the plan (`PBI-<id>:plan`) and `planning inspect`: which phases and plans are done (SUMMARY), which are next.
- Note the build and test commands `<implementation>` names; with none configured, find the repo's own (solution, package scripts) and say so in the verdict.
- Open the sandbox once and keep it for the run; `sandbox_sync` after every wave's commits.

## Executing
- One phase at a time, in roadmap order; GSD runs its waves in order. Don't restart a phase that is still working.
- One commit per task is GSD's: don't squash, amend or rebase its commits. Your own fixes are separate commits.
- After each wave: build, then test, in the sandbox. Red → fix in the worktree, commit, sync, run again. A failure the plan can't fix (wrong contract, missing data) goes back to planning, not into a new plan.
- `## CHECKPOINT REACHED`: decide it from the plan, the code and the PBI with evidence; record each with how you settled it. A business decision you can't prove stays open for the person.

## Verifying
- verify-work stops on text; answer it in the same conversation. Gates: the recommended option when the PBI supports it. Human tests: `skip: needs a person: <why>`. Never `pass` without seeing it pass.
- One gaps round at most (`--gaps-only`), then verify again. What stays open is the hand-over's.
- The verdict line: per phase the verifier's status and score, plus the last build and test result.

## Hand-over
- `write_implementation` first: summary for the reviewer (what changed and why), the pull request title in the repo's style, the verdict, the checkpoints.
- `hand_off` to a person, task, intent review, gate none. Steps: review the commits in the worktree; one step per open UAT item (what to test, where, what to report back); push the branch and open the pull request with the description in the task.
- The package names the hand-over state: ready (verified, nothing open), needs-person (tests only a person can run) or gaps (plans not done, verification failed), and why.
- Never push, never open the pull request, never run the ship step.

## Bugs of a PBI (child items)
- Built on the parent's branch, inside the parent's plan: only the fix's plans, with the bug's reproduction as a test.
