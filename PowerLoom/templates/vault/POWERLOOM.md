<!-- PowerLoom owns this file: every PowerLoom start rewrites it. Don't edit it here; change PowerLoom's template. -->
# PowerLoom tools

PowerLoom keeps the PBIs of this vault ({{vaultPath}}), what its agents found, and the user's own notes. A Claude chat
reaches it through PowerLoom's command line (no MCP server yet):

```bash
docker exec -i powerloom-web-1 npm run -s cli -w @powerloom/web -- <command> '<json input>'
```

- The answer is JSON: `{"ok": true, "value": …}`, or `{"ok": false, "error": "…"}` with exit code 1.
- Without a command it lists every command with its input schema.
- `pbi.read`, `pbi.get`, `sql.query` and `sql.describe` only read. Ask the user before any other command: they change PowerLoom.

## Working on a PBI
1. Start with `pbi.read '{"ref":"PBI-<id>"}'`: the PBI's prepared context, the same the agents get. It holds the ADO
   fields, the note (description, acceptance criteria), the user's own notes (`<user-notes>`), the parent, links,
   attachments, questions with the team's answers, and every related item as a reference (`<pbi-related>`).
2. Read any reference it lists in full with `pbi.read '{"ref":"<ref>"}'`: `PBI-<id>:refinement`, `PBI-<id>:design`,
   `PBI-<id>:estimate` (the latest estimate from any agent), an item id (`Q-…`, `HT-…`, `AT-…`, `F-…`, `RR-…`), `DRAFT-<n>`, an attachment `ATT-<n>`, a test case `TC-<id>`, or another `PBI-<id>`.
3. `pbi.get '{"link":"<ADO link, #id or id>"}'`: fields, statuses, parent, child items, repos, skills, note path.

Answers in `<existing-items>` are the team's decisions; the user's notes are their own input on the PBI.

## Reading SQL
The vault's Read SQL connections (Settings > Read SQL), with the agents' guards: one `SELECT` or `WITH`, rolled back,
at most 200 rows. Every read goes to the data access log. Pass the JSON on stdin so the SQL needs no shell quoting:

```bash
docker exec -i powerloom-web-1 npm run -s cli -w @powerloom/web -- sql.query <<'JSON'
{"vault": "{{vaultName}}", "connection": "<name>", "sql": "SELECT TOP 20 Id, Status FROM dbo.Verification"}
JSON
```

- `sql.describe` with `{"vault", "connection"}` lists the tables; add `"table": "dbo.Verification"` for its columns. Describe first, then query.
- A wrong or disabled connection name answers with the enabled ones.

## Commands that change PowerLoom (ask first)
| Command | Does |
|---|---|
| `item.close` | answers a question or closes a human task |
| `review.answerComment` | answers a code-review comment |
| `pbi.create`, `pbi.delete`, `pbi.finish` | creates, deletes or finishes a PBI |
| `pbi.close`, `pbi.reopen` | closes a PBI in PowerLoom (kept for the agents, work on it stops) or reopens it |
| `pbi.saveRepos`, `pbi.saveSkills` | sets a PBI's repos or skills for later agents |
| `bug.report` | reports a bug found on a PBI |
| `task.rerun` | runs a finished agent task again |
| `www.create` | adds a What-went-wrong record |
| `chat.open` | opens a Continue chat |
