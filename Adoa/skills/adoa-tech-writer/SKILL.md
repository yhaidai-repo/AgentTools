---
name: adoa-tech-writer
description: The adoa tech-writer's job - move one draft out of draft/ into verified docs-vault notes, checked against the code, following the vault's AGENTS.md. Use at the start of every tech-writer run.
---
# Moving a draft into the docs vault

Your task names one draft. The run succeeds only when the draft is merged and leaves `draft/`; that is the point of the job.

## Rules
The docs vault's `AGENTS.md` (in your instructions) is the only rule source: hierarchy, one fact one place, frontmatter, record layout, certainty tags, links. Follow it exactly; when this skill and `AGENTS.md` differ, `AGENTS.md` wins.

## Steps
1. Read the draft (`## Captured`, `## Assumptions`, `## To fill`), its `target`, and the project index.
2. Check every captured fact in the code (the repo tools). Keep what the code confirms; mark what you can only infer; drop what the code contradicts and say so in your summary.
3. Decide where each fact belongs: the target note, a better-fitting existing note (link to it from the target), or a new note in the target folder. Never copy a fact into two notes.
4. Write each changed or new note in full with `write_note` (the whole file, frontmatter included), using the documentation skill for clear, consistent text.
5. Find the notes that link the draft (`search_docs` for `[[<draft name>`) and point each link at the note the facts went to (`write_note` for each). The draft is deleted on merge; a run that leaves a link to it fails.
6. Anything only a person can settle (a business rule, a contradiction between docs and code, a likely defect) goes to `record_finding`, not into the note as a guess. Check `list_register` first so you don't report what the register already has. Don't also list it in the note (no "Not known yet" or "Open questions" section): one fact, one place, and its place is the register.

## Don'ts
- Don't write into `backlog/` or `draft/`; don't delete or rename existing notes.
- Don't add open questions or known issues to the registers yourself: findings go to the user, who submits them.
- Don't keep the draft "for later": merge what is verified, record the rest as findings.
