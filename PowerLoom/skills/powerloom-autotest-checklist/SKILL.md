---
name: powerloom-autotest-checklist
description: How the PowerLoom Autotest agent analyses acceptance criteria against test cases and plans end-to-end cases. Use when starting a test task, before writing the test report.
---

# Autotest checklist

## Analysis (before the plan)
- Number the acceptance criteria as the PBI lists them (AC 1, AC 2, …); every finding and case names one.
- Map each test case to the criteria it proves; a test case that proves none is a finding, not a case.
- A contradiction is when the criterion and the test case's expected result can't both be true; quote both sides.
- Test data: a step that needs a record, an id, a user, a payer, a facility or an environment nobody named is `missing_test_data`; the refinement's test data block and the answers may already hold it.
- Ambiguous expectations ("works correctly", "is shown") become a question with the readings as options.

## Plan
- One case per criterion; split a criterion with several observable results into several cases.
- Steps name the screen, the action and the value; the expected result is something a person sees or a query returns.
- Data per case: which existing records, which user, which environment; never invent ids.
- A blocked case keeps its steps so it runs as soon as its task closes.

## Services
- Start from the repos and areas the refinement and the design name; the service that owns the screen comes first, then what it calls (map.json's calls), then the consumers an action triggers.
- Name only services `list_services` offers; the rest stays on Azure dev.

## Before writing
- Every criterion appears exactly once in the cases (planned or blocked).
- Every finding has a resolution; blocking ones hold the task until they close.
- The plan question to the user summarises the cases in a few lines; the details are in the report.
