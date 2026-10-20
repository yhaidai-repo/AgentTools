---
name: powerloom-autotest-checklist
description: How the PowerLoom Autotest agent analyses acceptance criteria against test cases, plans end-to-end cases, runs them on a DevHub stack with a recorded browser and reports verdicts and bugs. Use when starting a test task, before writing the test report.
---

# Autotest checklist

## Analysis (before the plan)
- Number the acceptance criteria as the PBI lists them (AC 1, AC 2, …); every finding, case and result names one.
- Map each test case to the criteria it proves; a test case that proves none is a finding, not a case.
- A contradiction is when the criterion and the test case's expected result can't both be true; quote both sides.
- Test data: a step that needs a record, an id, a user, a payer, a facility or an environment nobody named is `missing_test_data`; the refinement's test data block and the answers may already hold it.
- Ambiguous expectations ("works correctly", "is shown") become a question with the readings as options.
- An answered question is the decision; a test case that still contradicts it goes into `ado_edits`, with the decision it follows. Never a task for ADO edits.

## Plan
- One case per criterion; split a criterion with several observable results into several cases.
- Steps name the screen, the action and the value; the expected result is something a person sees or a query returns.
- Data per case: which existing records, which user, which environment; never invent ids.
- A blocked case keeps its steps so it runs as soon as its task closes.
- Blocking tasks: the plan approval and whatever every case needs (test data, environment, user). One-case tasks are not blocking.

## Services and stack
- Start from the repos and areas the refinement and the design name; the service that owns the screen comes first, then what it calls, then the consumers an action triggers.
- Name only services `list_services` offers; the rest stays on Azure dev.
- `start_stack` with the branch under test; a service that doesn't come up is a `not_run` for its cases with the `stack_logs` lines, not a bug.

## Browser
- One `browser_open` … `browser_close` per case: the recording belongs to the case.
- Sign in with `browser_type_secret` (the dev test account's value names are in the task or DevHub); never type a secret with `browser_type`.
- Act on the snapshot's refs; after each action read the new snapshot before the next step.
- Take a screenshot at the step where the criterion is visible; it is evidence for the verdict and the bug.
- A step that fails once: take a snapshot, retry once; then decide the verdict.

## Verdicts and bugs
- `pass` only when the observable result matches the expected one; "looks fine" is not a pass.
- `fail` needs: the plan, data and environment were right, and the page or API showed something else. Then `report_bug` with steps as run, expected vs actual, the screenshot, log lines, the code location when known (inferred).
- One bug per distinct failure; cite an existing open bug instead of a duplicate; several cases failing for one cause share one bug.
- A failure caused by the plan, the data or the environment: a finding or a question, not a bug; the case is `blocked` or `not_run` with why.

## Before writing
- Every criterion appears exactly once in the cases (planned or blocked) and, after a run, once in the results.
- Every finding has a resolution; every failed result names its bug.
- `stop_stack` and `browser_close` are done; the report lists the recordings per case.
