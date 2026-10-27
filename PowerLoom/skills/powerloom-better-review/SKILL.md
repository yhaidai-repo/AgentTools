---
name: powerloom-better-review
description: How Better Review reviews one pull request against its PBIs, the repo's style and review rules, weighs other reviewers, learns rules, and follows up after fixes. Use when starting a Better Review run, before adding comments.
---

# Better Review

## Order of work
1. Read the linked PBIs in `<linked-pbis>`: write down each goal and every acceptance criterion (a `[BUG]` item: the reported behaviour and its parent's criteria). No PBI linked: review against the PR description and say so.
2. Read `<review-rules>`. A decision rule removes a point from the review; a lesson rule adds a check.
3. Earlier comments (`update_comment`): answered ones first, then, in a follow-up, every comment whose code changed.
4. `get_pr_diff` for the list; go through the files, riskiest first (domain logic, data access, contracts, security before UI text and tests).
5. Weigh `<other-reviewers>` once you know the change: `assess_reviewer_comment` per thread.
6. Check the criteria one by one against what you read, then `write_review_summary`.

## Business logic
- Trace each criterion to the code that does it: the entry point, the rule, the data written. "Met" needs the code that shows it.
- Ask what the PBI implies but doesn't say: the other statuses or types, empty and missing values, repeated calls, two users at once, existing data written before the change, a feature flag off.
- Compare with how the codebase does the same thing elsewhere (search for the entity or the rule); a different way for the same rule is a finding.
- A change that does more than the PBI asks is worth a comment when it changes behaviour nobody asked for.

## Style
- The repo's conventions decide, not general taste: look at neighbouring files, the same layer, `.editorconfig`, a CONTRIBUTING or AGENTS file, the docs vault's notes on the repo.
- Comment on style only when it breaks a convention the repo clearly follows, and cite where it does (file and line), or when it makes the code hard to read or change: names that mislead, a method doing several jobs, logic in the wrong layer, an existing helper duplicated.
- Never style points a formatter or linter enforces.

## Follow-up reviews
- The anchor is the commit the last review saw (`<review-mode>`): review only what changed since. The rest was reviewed; don't comment on unchanged code unless a change breaks it.
- For each earlier comment whose code changed: read the code now. Fixed → `fixed` with where. Partly or not → `keep` with `start_line` / `end_line` where it is now, and say what is still wrong. The fix created a new problem → a new comment.
- An answer without a code change: weigh it as in a first review.
- Threads marked weighed in `<other-reviewers>` got no comment since the last review: their verdict stands. Weigh the new and changed ones.
- A run the PR sync queued for reviewer comments (`<review-mode>` says so) may have no code change: weigh those threads, update the comments they touch, and write the summary.

## Research tasks
- Create one when a point depends on something this run can't settle: another repo or service, data in an environment, history the code doesn't show. Give the branch, the files and lines, and what decides the comment.
- Don't comment on that point until research answers; the next review run shows the answer in `<research>`.

## Rules
- Decision: the person declined a fix with a reason you accept. Write what later reviews should do, with the reason: "Don't ask for paging on the admin lists: they stay under 100 rows."
- Lesson: another reviewer caught a real issue you missed. Write the check: "Check that new endpoints in Api/Admin have the AdminOnly policy."
- One instruction each, beyond this PR, scoped (`applies_to`). Not for one-off fixes; not when an active rule already says it.

All unresolved comments, including nits and answered comments, block merge approval. Closing a review archives its unresolved comments and cancels unfinished review tasks; closing is not approval. Mark a comment fixed only with evidence, or explicitly withdraw an accepted declined suggestion; do not silently dismiss comments to pass this gate. Ready with fixes means changes are required before merge, never permission to merge now.
