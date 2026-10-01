# VaultCapture

Saves valuable session findings into vault drafts before an agent's context is compacted. The vault rules live in this module and are enforced in code.
PowerShell 7+, cross-platform, no dependencies.

## Layout

| Part | Knows about agents? | Role |
|---|---|---|
| `VaultCapture.psd1` (core module) | no | validates a capture against the vault rules, creates or appends a draft, logs the write |
| `vault-rules.json` | no | the rules: guidance for agents and draft constraints |
| `vault-capture.ps1` (CLI) | no | `rules` and `capture` for any agent or script |
| `Adapters/ClaudeCode/` | Claude Code only | `PreCompact` hook that pauses compaction once and tells the agent to save |

## Rules

`vault-rules.json`, or the file named by `VAULT_CAPTURE_RULES`.

- `guidance`: what agents must know before writing (shown by `rules` and in the hook message).
- `draft`: folder, name pattern, allowed sources, max lines, section names, default "To fill" bullet.

Vault roots: `vault-capture.config.json`, or the file named by `VAULT_CAPTURE_CONFIG`.

## Session project

A project is a top-level vault folder whose `<key>-index.md` frontmatter has `repo:` (a path, optionally `(folder Sub/)`). Folders without `repo:` (e.g. app-generated `backlog/`) are not projects.
The caller's working directory picks the project: the one whose repository contains it. A git worktree resolves to its main repository. Then `vault` and `project` are filled in, and a capture for another project is rejected. Outside any project repository, the caller passes `vault` and `project`.

## CLI

```bash
pwsh -NoProfile -File vault-capture.ps1 rules              # rules + how to capture, for agents
pwsh -NoProfile -File vault-capture.ps1 rules -Format json
```

```bash
echo '{"vault":"work-projects","project":"pvs","name":"pvs-topic","title":"Topic","source":"session finding","target":"[[pvs-index]]","captured":["fact"]}' | pwsh -NoProfile -File vault-capture.ps1 capture
```

Input JSON (stdin, or `-InputFile <path>`). `rules` and `capture` take `-Cwd` (default: where the command runs).

| Field | New draft | Append | Notes |
|---|---|---|---|
| `vault`, `project` | outside a project repository | same | filled from the working directory inside one |
| `name` | required | required | file name, kebab-case, unique in the vault |
| `title`, `target`, `source` | required | ignored | `source`: `user message`, `session finding`, `spec <id>` |
| `captured` | required | optional | bullets, one fact each |
| `sections` | optional | optional | `{ "Heading": ["bullet"] }` |
| `assumptions`, `toFill` | optional | optional | bullets |

Output: `{"ok":true,"mode":"created|appended|rejected","path":"…","errors":[]}`; exit code 1 when rejected.
An existing draft with the same name gets only the new bullets, in place. Rejected: unknown vault or project, another project than the working directory's, name clash with a verified note, note file paths instead of `[[note]]` links, appending to a non-draft or another project's draft, more than `maxLines`.

### Drafts waiting to be merged

```bash
pwsh -NoProfile -File vault-capture.ps1 drafts -Vault work-projects -PreferSource "session finding: adoa"
pwsh -NoProfile -File vault-capture.ps1 is-draft -Vault work-projects -Name pvs-topic -Name pvs-other
```

- `drafts`: every note in the vault's `draft/` folder (name, title, project, captured, source, target, path, preferred), for a writer to verify and merge. Drafts whose `source` starts with `-PreferSource` come first, then the oldest `captured` first.
- `is-draft`: `{"ok":true,"drafts":{"pvs-topic":true,"pvs-other":false}}`. `false` = no longer in `draft/` (merged or deleted). A caller waiting for drafts polls this.
- Both return `{"ok":false,"errors":[…]}` with exit code 1 for an unknown vault or a name that isn't a note name.

### Registers (open questions, known issues)

```bash
pwsh -NoProfile -File vault-capture.ps1 register -Vault work-projects -Project pvs -Kind questions
echo '{"vault":"work-projects","project":"pvs","kind":"issues","title":"Short title","text":"1-3 lines","default":["bullet"]}' | pwsh -NoProfile -File vault-capture.ps1 register-add
```

- `register`: `{"ok":true,"records":[{"id":"OQ-001","title":"…","status":"Open","resolved":false}],"path":"…"}` from `<project>/<project>-open-questions.md` or `-known-issues.md`. Reads the AGENTS.md record layout and the older one (title as a bold line under `## OQ-001`).
- `register-add`: appends a record with the next id in the AGENTS.md layout (heading with id and title, `> **Open** · Created … · Updated …`, `**Question**`/`**Issue**`, optional `**Default**` and numbered `**Options**`). Returns `{"ok":true,"id":"OQ-009","path":"…"}`. The caller must have the user's yes (vault rule "ask the user first").

## Claude Code adapter

`Invoke-PreCompactHook.ps1`, settings in `pre-compact.config.json` (`VAULT_CAPTURE_PRECOMPACT_CONFIG` overrides):

| Key | Meaning |
|---|---|
| `blockOn` | triggers to pause: `auto`, `manual` |
| `markerTtlMinutes` | how long the "already asked" marker counts |
| `stateFolder` | marker files, one per session |

Cycle: 1st compaction attempt → exit 2, the rules and capture command go to the agent → the agent saves → the next attempt is allowed. Errors always allow compaction.
On `manual`, the user runs `/compact` again after the agent saved.

Hook in `~/.claude/settings.json`:

```json
"PreCompact": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "pwsh -NoProfile -NonInteractive -File \"D:/Projects/AgentTools/VaultCapture/Adapters/ClaudeCode/Invoke-PreCompactHook.ps1\"",
        "timeout": 30
      }
    ]
  }
]
```

Other agents: call `Get-CaptureInstruction` (or `vault-capture.ps1 rules`) from their own pre-compaction hook, or run `rules` and `capture` by hand.

## Tests

`Invoke-Pester ./Tests` (Pester 5+).
