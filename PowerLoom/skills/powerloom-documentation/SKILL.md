---
name: powerloom-documentation
description: How to write a vault note other people and agents can rely on - who reads it, what goes first, how to show rather than tell, and how to keep it consistent with the notes around it. Use when writing or merging any note in a docs vault.
---
# Writing vault notes that stay useful

The docs vault's `AGENTS.md` decides the rules (layout, frontmatter, IDs, certainty tags). This skill is about writing well inside them.

## Before you write
- Name the reader: a developer changing the code, an agent planning a PBI, or the business. Write what that reader needs to act, nothing else.
- Find the note's neighbours first (the target note, its feature folder, the project index). New text has to fit their terms, headings and level of detail.

## The note itself
- Lead with the answer: the first lines say what the thing is and what it does; history and edge cases come after.
- Show it: the class or method that does it, the setting that switches it, a short example of the data. Cite symbols, not line numbers.
- One fact lives in one place. If another note already says it, link to it (`[[note]]`) instead of repeating it; if this note is the better home, move it here and link from the other.
- Keep it current: when a fact replaces an older one, change the old text instead of adding a contradicting line. A stale sentence is worse than a missing one.
- Short beats complete: bullets and tables, no padding, nothing the code already makes obvious.

## Consistency checks before you finish
- Terms match the project glossary and the neighbouring notes.
- Every claim has its certainty as the rules ask (code-read, inferred, runtime-verified).
- Links point to notes that exist; nothing points into `draft/`.
- The frontmatter is complete and its dates and `verified_against` reflect what you checked.
