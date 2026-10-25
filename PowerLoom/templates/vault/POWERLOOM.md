<!-- PowerLoom owns this file: every PowerLoom start rewrites it. Don't edit it here; change PowerLoom's template. -->
# PowerLoom tools

PowerLoom keeps the PBIs of this vault ({{vaultPath}}), what its agents found, and the user's own notes. A chat reaches
it through the `powerloom` MCP server this vault lists, in `.mcp.json` for Claude Code and in `.codex/config.toml` for
Codex (PowerLoom writes both entries): every PowerLoom command is a tool there, named with `_` (`pbi_read`,
`item_close`), next to the readers the agents have (vault docs, Read SQL, Read Azure, Azure DevOps, the whole system:
`task_list`, `run_get`, `agent_list`, `settings_get`, …). Why something failed: `run_events` for a run's own steps,
`logs_read` for what the services logged (a task that failed before its run started, a dispatch or sync that broke).

- Each tool says what it needs. A tool that changes PowerLoom says what to ask or confirm first: ask for what the user
  didn't say (never invent it), confirm a delete or a close naming the item, and show the final text before a submit.
- Tools marked read-only change nothing; the others change PowerLoom, so ask the user first.
- No `powerloom` tools in this chat? The MCP server isn't connected: say so; the user can do the same in PowerLoom's web UI.

## Working on a PBI
1. Start with `pbi_read` and `{"ref": "PBI-<id>"}`: the PBI's prepared context, the same the agents get. It holds the
   ADO fields, the note (description, acceptance criteria), the user's own notes (`<user-notes>`), the parent, links,
   attachments, questions with the team's answers, and every related item as a reference (`<pbi-related>`).
2. Read any reference it lists in full with `pbi_read` and `{"ref": "<ref>"}`: `PBI-<id>:refinement`,
   `PBI-<id>:design`, `PBI-<id>:estimate` (the latest estimate from any agent), an item id (`Q-…`, `HT-…`, `AT-…`, `F-…`,
   `RR-…`), `DRAFT-<n>`, an attachment `ATT-<n>`, a test case `TC-<id>`, or another `PBI-<id>`.
3. `pbi_get` with `{"link": "<ADO link, #id or id>"}`: fields, statuses, parent, child items, repos, skills, note path.

Answers in `<existing-items>` are the team's decisions; the user's notes are their own input on the PBI.

## Reading SQL
The vault's Read SQL connections (Settings > Read SQL), with the agents' guards: one `SELECT` or `WITH`, rolled back,
at most 200 rows. Every read goes to the data access log.

- `sql_describe` with `{"connection": "<name>"}` lists the tables; add `"table": "dbo.Verification"` for its columns.
  Describe first, then query.
- `sql_query` with `{"connection": "<name>", "sql": "SELECT TOP 20 Id, Status FROM dbo.Verification"}`.
- A connection is a server: `sql_databases` with `{"connection": "<name>"}` lists the databases its login can open; add
  `"database": "<name>"` to `sql_describe` and `sql_query` to read one other than the connection's own.
- A wrong or disabled connection name answers with the enabled ones. These tools read this chat's vault ({{vaultName}}).

## Tools that change PowerLoom (ask first)
| Tool | Does |
|---|---|
| `item_close` | answers or dismisses a question or finding, finishes (`answers`: one per step) or cancels a human task |
| `item_delete`, `task_rerun`, `task_notes_save` | deletes a question or task, runs a finished agent task again, saves a test task's notes |
| `finding_submit` | records a finding in a project's register (open question or known issue) and closes it |
| `review_add`, `review_queue`, `review_close`, `review_delete`, `review_answerComment`, `pullRequests_sync` | adds, starts, closes or deletes (from PowerLoom only) a review, answers a comment, checks for new pull requests |
| `pbi_create`, `pbi_delete`, `pbi_finish`, `pbi_close`, `pbi_reopen` | creates, deletes, finishes, closes or reopens a PBI in PowerLoom |
| `pbi_prepare`, `pbi_sync`, `pbi_importNow` | prepares PBIs for the agents, syncs from Azure DevOps, imports the inbox |
| `pbi_saveRepos`, `pbi_saveSkills`, `pbi_userNotes_save`, `pbi_attach` | sets a PBI's repos, skills or the user's notes; attaches a file by its path on this PC |
| `pbi_confluenceLink_add`, `pbi_confluenceLink_remove`, `pbi_confluenceLoad` | links or unlinks a Confluence page, loads a linked page |
| `bug_report` | reports a bug found on a PBI |
| `task_create`, `schedule_save`, `schedule_delete`, `schedule_tick` | creates a task or a schedule by task type, changes or deletes a schedule, creates its task now |
| `vault_add`, `vault_remove`, `vault_trashRestore`, `vault_trashDelete` | adds or removes a vault (its folder stays), restores or deletes a trashed note |
| `repo_enable`, `repo_addLocal`, `repo_remove`, `cleanup_run` | the vault's repo catalogue; runs the vault's cleanup |
| `vault_capture` | saves verified facts this vault lacks as a draft in draft/, for a person to verify and merge (always this chat's vault) |
| `register_add`, `register_close` | records an open question or known issue in a project's register; closes a record the user settled (always this chat's vault) |
| `www_create` | adds a What-went-wrong record |
| `agent_create`, `agent_update`, `agent_delete`, `agent_run`, `agent_pause`, `agent_saveGlobal` | creates, changes or deletes an agent, runs one now, pauses or resumes them all, sets the shared daily budget |
| `skill_create`, `skill_save`, `skill_restore` | creates a skill, rewrites one of PowerLoom's own skills, puts a revision of one back |
| `deadletter_replay`, `deadletter_discard` | runs a message PowerLoom gave up on again, or drops it for good |
| `chat_open` | opens a Continue chat |

Settings themselves (tokens, connections, switches) are changed on PowerLoom's Settings page; `settings_get` reads them.
