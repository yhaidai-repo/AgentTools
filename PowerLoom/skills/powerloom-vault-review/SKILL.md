---
name: powerloom-vault-review
description: The PowerLoom vault reviewer's job - pull stale notes, unlinked notes, invalid links and open WWW/KI/OQ records with the review tools, decide each note (keep, remove, actualize) from evidence, fix links, and close records the vault already settles or repeats, following each vault's AGENTS.md. Use at the start of every vault-review run.
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
6. Then `list_open_records` for each vault, and check each record (see "Records").
7. Open points only a person can settle → `record_finding` (docs vault notes only; check `list_register` first), else the summary.
8. `write_review_summary`: one line per decision, link fix and record, then what is left for the next run. It is refused while a removed note still has links: fix them first.

## Records (WWW, KI, OQ)
Read the whole register (`read_note`), then search the vault for each open record's id and key words (`search_vault`): feature notes, the other registers, the www-log.

| Decision | When | Evidence (quotes of this vault's notes) |
|---|---|---|
| `close_record` fixed | KI only: a note records the fix (date, PBI, commit), e.g. the record's own `**Fix**` line or the feature note | the words that record the fix |
| `close_record` resolved | OQ: a note records the answer or decision; KI: a note says it is not an issue or was settled; WWW: its fix and prevention are recorded (`Applied at` filled or the rule is in place) and nothing is left open | the words that record it |
| `close_record` duplicate | another record (any register of the vault) holds the same issue or question; close the newer or narrower one, `duplicateOf` = the one that stays | both records' words |
| `keep_record` | nothing in the vault settles it | what you searched for |

- Evidence is vault content only. The tool checks each quote word for word in the note you name. Code, git and PBIs you can't see in the vault don't count: if only they suggest it is settled, keep the record and say so in the summary.
- `decision` is one line, written into the record: what settled it, with the dates, PBIs or commits the evidence names. The tool adds the evidence links, and for KI/OQ the `[RESOLVED]` heading, status and `Updated` date; links to the record's heading are pointed at the register.
- A record that is partly settled stays open: keep it and name the open part.

## Don'ts
- Don't remove a note only because nobody read it; reference notes are read rarely.
- Don't remove when unsure: keep it and say what would settle it.
- Don't rewrite notes yourself: actualize sends the note to the tech-writer.
- Never touch root files, drafts or a project's own index and registers (the tools refuse it); registers change only through `close_record`.
- Never close a record on your own reasoning; never renumber or delete one.
