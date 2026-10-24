---
title: Maintenance guide for agents
type: meta
audience: [agent]
status: current
last_verified: {{date}}
tags: [meta]
---
# Maintaining this vault

Doc storage for the projects of this vault. Obsidian vault = `{{vaultPath}}`. Entry point: [[index]].
Other vaults are separate: no links, relations or shared notes between vaults.

## Hierarchy
```
{{vaultPath}}/ common: AGENTS.md, CLAUDE.md, index.md, www-log.md, draft/;
│              PowerLoom's MCP entry: .mcp.json (Claude Code), .codex/config.toml (Codex)
└── <key>/                  one project
    ├── <key>-index.md          project entry: repo path, feature table
    ├── <key>-known-issues.md   <key>-open-questions.md   <key>-glossary.md
    └── <feature>/              all notes of one feature (business + tech)
```
- New project → `<key>/` with the 4 `<key>-*` registers, plus a row in [[index]].
- New feature → folder under its project, plus a row in `<key>-index`.
- Cross-project links: put `[[note]]` in `related`, plus a row in the [[index]] **Relations** table.
- Note file names are unique across the whole vault, so `[[name]]` needs no path. Prefix with the project key on a clash.

## Ask, don't assume
- Not enough information to do the task correctly → **ask the user first** instead of guessing.
- Make as few assumptions as possible. Record every assumption you do make: tag it `(assumption)` inline, or list it under `## Assumptions` in the note, and tell the user about it in your reply.

## What went wrong
- Log misses and complaints in [[www-log]] via the global `www-record` skill (fault: Human or Agent).
- After the user corrects you, *propose* a WWW record; write it only after a yes.

## Be short
- Short notes, short answers. Bullets and tables, no padding, no repeated context.
- Target ≤ 80 lines/file. Split by feature scope before growing.

## Adding new information
**No research.** Record only what is already in your context (user messages, pasted specs, earlier findings). Research only when the user asks, or when a job fills a draft.

| What | Action |
|---|---|
| New information with no verified home | Note in `draft/` (template below). Don't merge it into verified notes. |
| New term | Add it to the project glossary yourself. |
| New known issue | **Ask the user first.** Add to `<key>-known-issues` only after a yes. |
| New open question | **Ask the user first.** Add to `<key>-open-questions` (or the feature's question file) only after a yes. |
| User answers an open question | Prefix the heading with `[RESOLVED]` (e.g. `## [RESOLVED] OQ-001 …`), set the metadata line to **Resolved**, bump `Updated`, add a short **Decision** block, update the affected notes. Links to that heading (`[[note#OQ-001]]`) break, so point them at the note instead: `[[note]] (OQ-001, resolved)`. |

Draft template (`draft/<unique-name>.md`):
```yaml
title: string
type: draft
status: draft
project: <key>
captured: YYYY-MM-DD
source: "user message" | "spec <id>" | "session finding"
target: "[[note]] or folder where it should end up"
```
Body: `## Captured` holds the facts as given (unverified). `## To fill` lists what still needs research. Whoever fills it verifies it, moves it to the target, and deletes the draft.

## Rules
- **One fact, one place.** Link, never copy. Business notes summarise; tech notes hold the detail.
- **Cite symbols, not line numbers.**
- **Stable IDs** per project: issues `KI-nnn`, questions `OQ-nnn`, feature-local prefixes allowed (e.g. `FTQ-nnn`). Never renumber or delete; set `status`. Cross-project reference: `[[adoa-known-issues#KI-001]]`.
- **Record layout** for issues and questions (`KI`, `OQ`, feature-local like `FTQ`): a metadata line right under the title, then labelled blocks. Set both dates on creation. Bump `Updated` on any content change, not on link-only rewrites. WWW records use the field list in [[www-log]].
  ```
  ## [RESOLVED] FTQ-001 Title as a question
  > **Open|Resolved|Fixed** · Blocks/Unblocks … · Created YYYY-MM-DD · Updated YYYY-MM-DD

  **Question** (or **Issue**): 1–3 lines
  **Default** (open) or **Decision** (who): bullets
  **Options**: numbered choices (open questions only)
  ```
- A resolved record never holds open parts. A leftover or follow-up question becomes a **new** record, linked from the resolved one with `Follow-up <ID>` in its metadata line.
- **Mark certainty.** A claim is code-read unless tagged `(inferred)` or `(runtime-verified)`.

## Frontmatter (every non-draft note)
```yaml
title: string
project: <key>           # omit for common root notes
type: business | tech | feature | issues | questions | glossary | meta
audience: [dev, agent, business]
scope: string            # = feature folder; omit for project registers
status: current | needs-review | stale
confidence: code-read | inferred | runtime-verified
last_verified: YYYY-MM-DD
verified_against: "git <sha> @ <repo path>"
sources: [paths relative to the project repo]
symbols: [key classes/methods]
related: ["[[note]]"]
tags: [<key>, ...]
```

## Verification (only when asked, or by a job)
1. Repo path comes from `<key>-index` (`repo:`). Drift: `git -C <repo> diff --stat <sha> HEAD -- <sources>`.
2. No diff → leave the note. Diff → re-read, edit, then bump `last_verified` / `verified_against` (only after re-reading).
3. Can't re-verify → `status: needs-review`. Issue fixed → `Status: fixed (date, commit)`.
