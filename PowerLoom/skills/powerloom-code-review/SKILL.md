---
name: powerloom-code-review
description: How the PowerLoom code-review agent reviews one pull request and writes comments a reviewer can act on. Use when starting a code review, before adding comments.
---

# Code review

## Order of work
1. `get_pr_diff` for the list; read the PR description and the linked PBIs: what is the change supposed to do?
2. Earlier comments with answers first (`update_comment`), so you don't repeat what was settled.
3. Go through the files in scope, largest and riskiest first (logic, data access, security-relevant code before UI text and tests).
4. For each hunk: read enough of the file around it (`read_file`) and follow calls one hop when behaviour depends on them.
5. Summary last.

## What to look for
- Correctness: wrong conditions, off-by-one, null / empty / missing cases, overflow, wrong error handling or errors swallowed instead of passed on, race conditions, changed behaviour callers rely on, type mismatches.
- Data: queries that can return too much or too little, N+1 queries, unbounded queries (no paging or limit), new filters or joins without a supporting index, missing transactions, migrations that break existing data.
- Performance: unbounded loops over growing data, O(n²) work in hot paths, needless allocations or copies in loops, resources not released (connections, streams, files, subscriptions), caches that never drop entries.
- Security: injection (SQL, command, XSS), missing authentication or authorization checks, CSRF on state-changing endpoints, secrets in code, unsafe deserialization, path traversal from user input, server-side requests to user-supplied URLs (SSRF), data leaking into logs.
- Fit: does the change do what the linked PBI asks? Missing acceptance criteria are worth a comment.
- A linked child item (a `[BUG]` Task, shown as "Child item of PBI-…"): the change fixes the reported behaviour and keeps the parent PBI's acceptance criteria. A fix that breaks one of them is a blocker.
- Tests: new logic without tests, tests that don't test what their name says.
- Design: duplication of an existing helper, a method doing several jobs, a change in the wrong layer, unclear names, non-obvious logic without a comment explaining why. Only when it matters for the PR.

## Severities
| Severity | Meaning |
|---|---|
| blocker | Must be fixed before merge: a bug, data loss, a security hole, a broken build or contract. |
| major | A real risk or defect that should be fixed in this PR. |
| minor | Worth fixing; the PR could merge without it. |
| nit | Optional polish. Use sparingly. |

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
