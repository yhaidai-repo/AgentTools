---
name: powerloom-autotest-checklist
description: How the PowerLoom Autotest agent validates or creates local test cases, checks data readiness, hands missing information to Refinement, runs end-to-end cases on a DevHub stack and reports verdicts and bugs. Use when starting or continuing a test task, before writing the test report.
---

# Autotest checklist

## Analysis (before the plan)
- Number the acceptance criteria as the PBI lists them (AC 1, AC 2, …); every finding, case and result names one.
- Map each test case to the criteria it proves; a test case that proves none is a finding, not a case.
- Validate each existing case: coverage of the criterion and resolved team decisions, explicit preconditions and permitted data references, ordered reproducible actions, and observable expected results. Missing information blocks validation; a mismatch with known requirements is a finding.
- When no case covers a criterion or observable result, create a local case in the report (`ref: agent`), using the requirements and citing their evidence in the findings. The same checks apply to created cases. Keep the case for the next run; never write it to Azure DevOps or invent requirements, ids or expected results.
- A contradiction is when the criterion and the test case's expected result can't both be true; quote both sides.
- Test data: a step that needs a record, an id, a user, a customer or an environment nobody named is `missing_test_data`; the refinement's test data block, the answers and your environment's rules may already hold it, and the database often does: search for a successful earlier call of the same kind, within what the rules allow and on any date, before asking, and reuse its inputs by record id.
- Ambiguous expectations ("works correctly", "is shown") become a question with the readings as options.
- An answered question is the decision; a test case that still contradicts it goes into `ado_edits`, with the decision it follows. Never a task for ADO edits.

## Missing information and data
- Check the PBI, attachments, answers, latest refinement and permitted data sources first. If a gap remains, `hand_off` to `refinement` with intent `ask`, its package naming the affected cases/criteria, missing fields or records, evidence of the checks, and done-when requiring the answer or usable data references in the refinement/answers.
- Reuse an existing open task on the same gap. Keep affected cases blocked by its id; a new task uses `new:<n>` until committed. Mark the task blocking when every case needs it; otherwise run the ready cases once approved and keep a partial report.
- Save a partial/blocked test report and result. `write_result.waiting_for` names reused open tasks needed for the next runnable step: while awaiting plan approval, omit data blockers that only affect other cases; after ready cases run, name the remaining open blockers. The report and result never say complete while cases still wait for missing information/data.
- On resumption, read the latest refinement and follow-up items, then check the supplied data against each case's preconditions. Closing a task without supplying the data does not unblock execution. Wait for an open follow-up that owns the remaining gap; cancellation is a decision, not a reason to create a duplicate.
- If refinement delegation fails, create/reuse a user task with steps to fix the configuration, access or task-limit problem; its id is the affected cases' `blocked_by`. If task creation itself is unavailable, keep those cases `planned` without `blocked_by`, record `not_run` results with the missing data and handoff failure, and save a blocked report/result without invented dependency ids for a person to settle before Re-run.

## Plan
- One or more cases per criterion: one per observable result, each with its own title; no criterion without a case.
- Steps name the screen, the action and the value; the expected result is something a person sees or a query returns.
- Data per case: which existing records, which user, which environment; never invent ids.
- A blocked case keeps its steps so it runs as soon as its task closes.
- Blocking tasks: the plan approval and whatever every case needs (test data, environment, user). One-case tasks are not blocking.

## Environment
- The environment section of your instructions (the vault's `ENVIRONMENT.md`) names the SQL connection the stack runs on, the test data you may use (which customers, records, tenants), the accounts by secret name, and the caps on paid or shared actions. Follow it exactly; it is stricter than this skill where they differ.
- A record, user or account within those rules is not `missing_test_data`: pick one yourself instead of asking the user. Never invent one, and never use data the rules exclude.
- An action the rules call paid or shared (a submit, an upload, a call to an outside service): one record per action, never a bulk or batch action, and only as many as the cases need, within the cap. Without such rules, ask the user before the first such action.

## Services and stack
- Start from the repos and areas the refinement and the plan name; the service that owns the screen comes first, then what it calls, then the consumers an action triggers.
- Name only services `list_services` offers; the rest stays on Azure dev.
- `start_stack` with the branch under test; a service that doesn't come up is a `not_run` for its cases with the `stack_logs` lines, not a bug.
- A background host runs no worker by default. A case that waits on a job names its worker in `start_stack` `config` (`{"<host service>": {"workers": {"<Worker>": {"RunAtStart": true, "Cron": "15"}}}}`); `stack_status` shows the workers in effect. Workers that reach outside the stack (email, uploads, reports to customers) stay off unless the criterion is about them.

## Browser
- One `browser_open` … `browser_close` per case: the recording belongs to the case.
- Sign in with `browser_type_secret` (`list_secret_names` shows the value names; your environment's rules say which account is for what); never type a secret with `browser_type`.
- API cases: `http_request` from the host with `{{secret:<api key value name>|basic}}` as the Authorization header; the body comes back redacted.
- Never select credential columns (`ApiKey`, `Password`, keys, tokens) with `sql_query`; look up the value name instead and use it by name.
- Act on the snapshot's refs; after each action read the new snapshot before the next step.
- Take a screenshot at the step where the criterion is visible; it is evidence for the verdict and the bug.
- A read or a repeat-safe step that fails once: take a snapshot, retry once; then decide the verdict.
- A submit, save or call to a paid or outside service that timed out or answered unclearly: check its record or status (SQL, the screen) before anything else; repeat it only when it clearly did not happen, and count the repeat in your environment's cap.

## Verdicts and bugs
- `pass` only when the observable result matches the expected one; "looks fine" is not a pass.
- `fail` needs: the plan, data and environment were right, and the page or API showed something else. Then `report_bug` with steps as run, expected vs actual, the screenshot, log lines, the code location when known (inferred).
- One bug per distinct failure; cite an existing open bug instead of a duplicate; several cases failing for one cause share one bug.
- A failure caused by the plan, the data or the environment: a finding or a question, not a bug; the case is `blocked` or `not_run` with why.
- Bug retests: every bug in `<bugs-to-retest>` gets a case (ref `PBI-<id>`) or rides on the planned case that proves it; its result's `bug` is `PBI-<id>` whatever the verdict. A done bug that fails again is "still failing", not a new bug; never change a bug's state.

## Continuing from a previous report
- The `<previous-report>` block is the plan: run the cases without a `pass`; keep a passed verdict with the earlier report as its evidence only while the commit under test (a new commit on the same branch counts), the services and config, the data and the expected result are the same, and the user didn't ask for a rerun.
- A blocked case runs after its missing information/data is verified and the plan is approved. The existence of an earlier report proves neither readiness nor approval. One whose item was cancelled stays blocked with that id in `observed`, without a new task.

## Before writing
- Every criterion has at least one case (planned or blocked); after a run, every case has exactly one result.
- Every finding has a resolution; every failed result names its bug.
- `stop_stack` and `browser_close` are done; the report lists the recordings per case.
