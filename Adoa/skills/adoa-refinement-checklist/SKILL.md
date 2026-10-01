---
name: adoa-refinement-checklist
description: Checklist the adoa refinement agent applies to a PBI before deciding what to research or ask. Use when refining a PBI, checking acceptance criteria, or deciding whether a PBI is ready for design.
---

# Refinement checklist

Go through each point. A point that fails becomes an acceptance-criteria gap, a research task (answerable from code or docs) or a question (only a person can answer).

## The ask
- The user or system outcome is stated, not only the solution.
- Scope boundaries are clear: what is explicitly out.
- The PBI is small enough for one sprint; if not, say how it could be split.

## Acceptance criteria
- Each criterion is testable: given / when / then, or a concrete observable result.
- Error and empty cases are covered: no data, invalid input, permission denied, timeouts.
- Data rules are explicit: which records, which fields, which time zone and date boundaries.

## Context
- Affected users, roles and permissions are named.
- Integrations, events and messages that trigger or consume this are named.
- Data changes are named: new fields or tables, migrations, backfills, reports.
- Related PBIs, known issues and open questions in the docs are linked.

## Readiness for design
- Every research task has one question and a goal.
- Every question says why it matters and, when possible, offers options.
- If nothing is open, the PBI is ready for design: create no research tasks.
