---
title: What-went-wrong log
type: log
audience: [dev, agent]
status: current
last_verified: {{date}}
tags: [meta, www]
---
# What-went-wrong (WWW) log

Tracks user complaints and noticed cases where work did not go as planned: cause, fault, resolution, and prevention. Records are created only through the `www-record` skill (rules: [[AGENTS]]). Don't edit the statistics by hand; the skill recalculates them.

## Statistics
<!-- stats:start -->
| Metric | Count |
|---|---|
| Not as planned (total records) | 0 |
| Fault: Human | 0 |
| Fault: Agent | 0 |
| Status: open | 0 |
| Status: resolved | 0 |
| Preventive action applied | 0 |
| Preventive action proposed, not applied | 0 |
<!-- stats:end -->

## Record format
```
## WWW-nnn Short title
- Created: YYYY-MM-DD · Updated: YYYY-MM-DD
- Kind: complaint | notice
- Project: <key> | common
- Planned: what was expected
- Happened: what actually happened
- Fault: Human | Agent | Human, Agent
- Root cause: one line
- Resolution: what fixed it, or "–"
- Preventive action: rule/change that stops a repeat
- Applied at: where the prevention now lives ([[AGENTS]], memory, skill…) or "–"
- Status: open | resolved
- Assumptions: none | list
```
`complaint` = the user reported it. `notice` = the agent or the user spotted it without a complaint.

## Records
