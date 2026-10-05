---
name: adoa-vault-review
description: The adoa vault reviewer's job - pull stale notes, unlinked notes and invalid links with the review tools, decide each note (keep, remove, actualize) from evidence, and fix links, following each vault's AGENTS.md. Use at the start of every vault-review run.
---
# Reviewing the vaults

Your task is one review pass. The run succeeds only when `write_review_summary` is called; everything else is staged and applied after it.

## Rules
Each vault's `AGENTS.md` (in your instructions) is the only rule source: one fact one place, links, frontmatter, statuses. When this skill and `AGENTS.md` differ, `AGENTS.md` wins.

## Steps
1. Start with `list_invalid_links` for each vault: dead links are the surest fixes. Repoint each to the note it meant (`similar` names, `list_notes`, `search_vault`) or drop it with `fix_link(to = null)`.
2. Then `list_stale_notes` and `list_unlinked_notes`, oldest use first. For each note: `read_note`, `list_backlinks`, `list_links`, and the code when the note documents code (its `sources` and `symbols`, the repo tools).
3. Decide (one call per note, within the run's cap):

| Decision | When | Evidence to give |
|---|---|---|
| `keep_note` | still true and needed, only rarely read (reference, runbook, rule) | what you checked; for an orphan, which index should link it |
| `remove_note` | its subject is gone (feature dropped, project ended, code deleted) or other notes already hold every fact | where the facts live now, or proof the subject is gone |
| `request_actualization` | the subject still exists but facts drifted (symbols renamed or gone, `sources` changed since `verified_against`) | the suspect facts and what the code says instead |

4. For a removed note, fix every link to it (`list_backlinks`): repoint it to the note that holds the facts now, or drop it.
5. Check the links of the notes you open (`list_links`): a link whose target no longer means what its line says (renamed scope, moved facts) is repointed to the right note or dropped.
6. Open points only a person can settle → `record_finding` (docs vault notes only; check `list_register` first), else the summary.
7. `write_review_summary`: one line per decision and link fix, then what is left for the next run. It is refused while a removed note still has links: fix them first.

## Don'ts
- Don't remove a note only because nobody read it; reference notes are read rarely.
- Don't remove when unsure: keep it and say what would settle it.
- Don't rewrite notes yourself: actualize sends the note to the tech-writer.
- Never touch root files, drafts or a project's own index and registers (the tools refuse it).
