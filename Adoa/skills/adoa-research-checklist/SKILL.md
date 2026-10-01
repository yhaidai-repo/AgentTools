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

## Evidence
- Each finding cites `<repo>/<path>:<line>` and the symbol, or a doc path.
- Distinguish: found in code, stated in docs, inferred. Mark inferences.
- If docs and code disagree, trust the code and note the doc as outdated.

## Result
- Conclusion answers the question directly: yes/no/how/where first, then the key detail.
- Confidence: high = read the code path end to end; medium = strong hints, gaps remain; low = mostly inferred.
- Hand over to design: the docs and code locations to start from.
- Open points that code can't answer → question; work that needs a person → human task; a new unknown → follow-up task (sparingly).
