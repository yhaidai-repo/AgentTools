---
name: powerloom-agent-author
description: How a chat creates a PowerLoom agent or skill the user describes. Use when the user asks for a new agent, a new skill, or an agent that does something no agent does yet; ends in agent.create / skill.create.
---

# Authoring a PowerLoom agent or skill

A PowerLoom agent is a prompt, the skills it may load, the task types it takes and its grants; every agent runs the same
way (the generic executor), so creating one is writing those four things well. A skill is a `SKILL.md` an agent loads
on demand: case knowledge, checklists, rules. Decide first which the user needs:

- **Skill** when an existing agent should know more or work differently in a case (a checklist, a code area's rules).
- **Agent** when something should run on its own tasks (a kind of task, a schedule, its own prompt and grants).

## Ask before you create (one round, short)
1. **Goal**: what should it produce, for whom, and how will the user know it did well?
2. **Input**: what does it read: the PBI, the task text, the vault docs, code (which repos), SQL, Azure, Confluence,
   the web? Each is a grant; read-only ones are cheap to give, writers change PowerLoom.
3. **Output**: what does it write: just its result (`write_result`, always there), notes in the vault, a research
   result, a design, a refinement, a review, a test report? Each is a grant (`writeNotes`, `researchResult`,
   `writeDesign`, `writeRefinement`, `reviewCode`, `reviewPullRequests`, `writeTestReports`).
4. **When**: which task types it takes (`handles`): refinement, research, design, docs, review, vault-review, test;
   on a schedule or on demand; whether it may hand work on (`canAssign`).
5. **Name**: an id in lower-case letters, digits and dashes, a label, and one line for the Agents page.

Skip questions the user has answered already. Propose defaults for the rest (model, limits, budgets) and say them.

## Write the prompt
- Start with `{{framework}}` (the shared framework: verify, evidence, hand on, write the result).
- `## Your job`: the goal in the user's words, the inputs to read first, what "done" means.
- `## Result`: the sections `write_result` should have and when its status is complete, partial or blocked.
- Keep it under a page; case knowledge goes into a skill, not the prompt.
- `{{team}}` and `{{agent}}` are filled per run.

## Write a skill
- `name`: lower-case, dashes; `description`: one line saying when an agent should load it (agents choose by it).
- Body: checklists and rules an agent can follow step by step; cite files and symbols when they matter.

## Then
- `skill.create` first when the agent needs a new skill, then `agent.create` naming it in `skills`.
- `agent.create` saves the agent disabled; tell the user to review it on its Config page (prompt, grants, schedule)
  and switch it on there, or pass `enabled: true` when they asked for that.
- Show the user what you are about to create (prompt included) and ask once before the call: these commands change
  PowerLoom.
