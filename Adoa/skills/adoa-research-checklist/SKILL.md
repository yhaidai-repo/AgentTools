---
name: adoa-research-checklist
description: How the adoa research agent answers one research question with evidence. Use when starting a research task, before writing the research result.
---

# Research checklist

## Before searching
- Restate the task's question in one line; that is what the conclusion must answer.
- Read the docs refinement chose first; they often name the classes, events or tables to look for.

## Searching code
- Search for the exact names first (types, events, table names, config keys), then broaden.
- Follow each hit to its definition and its callers; one hop each way is usually enough.
- Use `git_log` on the key file when "is this used / recent / still true" matters.
- Stop when the question is answered; don't map the whole system.

## Bugs about data or state
- Ask first why the data is in this state: what should have changed it, and why didn't it run?
- Follow the fix's path downstream: what the job, event or consumer updates (projections, counters, other services).
- Find earlier writers of the same state: backfills, migrations, `deployments/` notes; check they agree with the live path.
- Before reporting a defect, check guards on the path (global query filters, idempotency checks).
- End with: does fixing the root cause alone remove every symptom? Yes/no and the evidence.

## Bugs of a PBI (child items)
- Start from the parent's design plan in `<parent-pbi>`: the bug is usually in code the plan changed.
- The repos are cloned on their default branch; the parent's changes may exist only on its branch. When the evidence depends on them, say so instead of concluding the code is missing.

## Evidence
- Each finding cites `<repo>/<path>:<line>` and the symbol, or a doc path.
- Distinguish: found in code, stated in docs, inferred. Mark inferences.
- If docs and code disagree, trust the code and note the doc as outdated.

## Result
- Conclusion answers the question directly: yes/no/how/where first, then the key detail.
- Confidence: high = read the code path end to end; medium = strong hints, gaps remain; low = mostly inferred.
- Hand over to design: the docs and code locations to start from.
- Open points that code can't answer → question; work that needs a person → human task; a new unknown → follow-up task (sparingly).
- A human task says in short why a person must do it and which problem the answer solves. Each log or data step brings the query to run (KQL, SQL), with the resource, environment and time range filled in; never "check the logs for …" without one.
