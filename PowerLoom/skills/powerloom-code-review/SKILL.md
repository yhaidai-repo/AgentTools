---
name: powerloom-code-review
description: "Review a pull request with PowerLoom Code review or Better Review: check correctness and acceptance criteria, write actionable comments, and handle follow-ups. Use before starting either review workflow."
---

# Code review

Use the tools and context supplied to this run. Steps concerning `<review-rules>`, `<review-mode>`,
`<other-reviewers>`, rule learning and research tasks apply when that context and the corresponding tools are available.

## Order of work
1. Read the PR description and linked PBIs: identify each goal and acceptance criterion. For a `[BUG]` child, include the reported behaviour and its parent's criteria. Without linked PBIs, review against the PR description and say so.
2. Read `<review-rules>` when supplied. A decision rule removes a settled point from the review; a lesson rule adds a check.
3. Handle earlier comments with answers first (`update_comment`); in a follow-up, also revisit comments whose code changed.
4. `get_pr_diff` for the files in scope; read the riskiest first (domain logic, data access, contracts and security before UI text and tests). For each hunk, read the surrounding code and follow calls when behaviour depends on them.
5. When `<other-reviewers>` is supplied, weigh its new or changed threads with `assess_reviewer_comment` after understanding the change.
6. Check each acceptance criterion against the evidence, then write the review summary. End with `write_result` as the agent prompt requires.

## What to look for
- Correctness: wrong conditions, off-by-one, null / empty / missing cases, overflow, wrong error handling or errors swallowed instead of passed on, race conditions, changed behaviour callers rely on, type mismatches.
- Data: queries that can return too much or too little, N+1 queries, unbounded queries (no paging or limit), new filters or joins without a supporting index, missing transactions, migrations that break existing data.
- Performance: unbounded loops over growing data, O(n²) work in hot paths, needless allocations or copies in loops, resources not released (connections, streams, files, subscriptions), caches that never drop entries.
- Security: injection (SQL, command, XSS), missing authentication or authorization checks, CSRF on state-changing endpoints, secrets in code, unsafe deserialization, path traversal from user input, server-side requests to user-supplied URLs (SSRF), data leaking into logs.
- Fit: does the change do what the linked PBI asks? Missing acceptance criteria are worth a comment.
- A linked child item (a `[BUG]` Task, shown as "Child item of PBI-…"): the change fixes the reported behaviour and keeps the parent PBI's acceptance criteria. A fix that breaks one of them is a blocker.
- Tests: new logic without tests, tests that don't test what their name says.
- Design: duplication of an existing helper, a method doing several jobs, a change in the wrong layer, unclear names, non-obvious logic without a comment explaining why. Only when it matters for the PR.

## Business logic and style
- Trace each criterion through the entry point, domain rule and data written. Mark it met, partly, not met, not verifiable or out of scope, with evidence.
- Check implied cases: other statuses and types, empty or missing values, repeated or concurrent calls, older persisted data and disabled feature flags.
- Compare equivalent rules and existing helpers elsewhere in the codebase. Comment on a behavioural difference or an established convention it breaks, with the source.
- A change beyond the PBI's scope deserves a comment when it changes behaviour nobody requested.
- Judge style by neighbouring code, the same layer, `.editorconfig`, CONTRIBUTING, AGENTS and relevant repo documentation. Cite an example of an established convention when raising a style issue.
- Raise readability or layering problems when they materially affect understanding or maintenance. Skip points enforced by formatters or linters.

## Severities
| Severity | Meaning |
|---|---|
| blocker | Must be fixed before merge: a bug, data loss, a security hole, a broken build or contract. |
| major | A real risk or defect that should be fixed in this PR. |
| minor | Lower-impact issue worth fixing; a raised comment still needs resolution before approval. |
| nit | Polish. Use sparingly; an unresolved nit still blocks approval. |

## Writing a comment
- First line: the problem, concretely ("`total` is never reset between batches, so the second batch reports both").
- Then why it matters and what to do instead, with a short code sketch when it helps.
- Lines: the smallest range that shows the problem, on the new side of the diff.
- One issue per comment; no "also, …".

## Answers from the reviewer
- They know the codebase and the context; take a reasoned answer seriously.
- Withdraw when the answer resolves the point, and say so in the reply.
- Keep when it doesn't, and say what is still wrong; don't just repeat the comment.
- Refine when the answer shows the comment was unclear or partly wrong.

## Follow-up reviews
These steps apply to runs with `<review-mode>`; other runs follow their agent prompt's handling of earlier comments.

- When `<review-mode>` supplies the previous review's commit, review changes since that anchor. Read unchanged code for context; comment on it only when a new change breaks it.
- For an earlier comment whose code changed: mark `fixed` only with evidence; otherwise `keep`, move its line range to the current code and explain what remains. Report a new problem introduced by the fix as a new comment.
- Weigh answers without code changes as in a first review. Do not repeat earlier issues as new comments.
- A thread marked weighed in `<other-reviewers>` retains its verdict unless new comments or this run's code changes affect it. A reviewer-comment follow-up may contain no code changes.

## Research and learned rules
- When `create_task` offers research, delegate a point that depends on another service, environment data or history this run cannot establish. Supply the branch, files, lines and evidence needed to decide it. Wait for the answer before commenting on that point; name the gap in the summary.
- When rule-learning tools are available, an accepted reason to decline a fix can become a decision rule; withdraw the comment explicitly. A valid issue another reviewer caught that you missed can become a lesson rule; add your own comment if it still applies.
- Each learned rule is one short instruction, with its reason and `applies_to` scope, useful beyond this PR. Do not duplicate an active rule or turn a one-off fix into a rule.

## Merge approval
All unresolved comments, including nits and answered comments, block merge approval. Closing a review archives its unresolved comments and cancels unfinished review tasks; closing is not approval. Mark a comment fixed only with evidence, or explicitly withdraw an accepted declined suggestion; do not silently dismiss comments to pass this gate. Ready with fixes means changes are required before merge, never permission to merge now.
