# VaultUsage

Tracks which vault notes agents use, how often, and when they last used them. Use it to audit and prune doc vaults.
PowerShell 7+, cross-platform, no dependencies.

## Layout

| Part | Knows about agents? | Role |
|---|---|---|
| `VaultUsage.psd1` (core module) | no | resolves paths to vault notes, appends usage, builds reports |
| `vault-usage.ps1` (CLI) | no | `record` and `report` for any agent or script |
| `Adapters/ClaudeCode/` | Claude Code only | hook adapter and transcript import that call the core |

New agent = new folder under `Adapters/` that maps its tool calls to `record`. The core never changes.

## Config

`vault-usage.config.json`, or the file named by `VAULT_USAGE_CONFIG`.

| Key | Meaning |
|---|---|
| `vaults` | vault roots; usage outside them is ignored |
| `extensions` | tracked note types (`.md`) |
| `excludeFolders` | folders never tracked (`.obsidian`, `.usage`) |
| `logFolder`, `logFile` | log location inside each vault (`.usage/usage.jsonl`, hidden from Obsidian) |
| `writeWindowSeconds` | hook only: a note modified within this many seconds of a shell command counts as written by it (default 15) |

## Record usage (any agent)

```bash
pwsh -NoProfile -File vault-usage.ps1 record -Path D:/Claude/work-projects/index.md -Kind read -Agent codex -Session 42
```

| Parameter | Required | Notes |
|---|---|---|
| `-Path` | yes | absolute, or relative to `-Cwd`; repeat for several files; non-vault paths are skipped |
| `-Kind` | yes | `read`, `search`, `write`, `shell` |
| `-Agent` | yes | agent name, e.g. `claude-code`, `codex` |
| `-Subagent`, `-Session`, `-EventId`, `-Source`, `-Cwd`, `-Timestamp` | no | `-EventId` lets imports skip calls already recorded |

## Report

```bash
pwsh -NoProfile -File vault-usage.ps1 report -Since 2026-09-01 -Format markdown -OutFile usage-report.md
```

`-Vault` limits to one vault. `-Format`: `markdown` (default), `json`, `csv`, `object`.
Sections: used notes (reads, searches, shell, writes, sessions, last used, last read), never used, logged but missing.

## Log contract

One JSON object per line in `<vault>/.usage/usage.jsonl`. Adapters depend only on this shape.

```json
{"ts":"2026-09-30T11:35:08Z","file":"pvs/pvs-index.md","kind":"read","agent":"claude-code","subagent":"Explore","session":"…","source":"hook","eventId":"toolu_…"}
```

`file` is relative to the vault root with `/` separators.

## Claude Code adapter

| Script | Use |
|---|---|
| `Invoke-ClaudeHook.ps1` | `PostToolUse` hook (async); reads the hook JSON from stdin |
| `Import-ClaudeHistory.ps1` | backfill from `~/.claude/projects/**/*.jsonl`; safe to re-run |

Hook in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Read|Edit|MultiEdit|Write|Grep|Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -NonInteractive -File \"D:/Projects/AgentTools/VaultUsage/Adapters/ClaudeCode/Invoke-ClaudeHook.ps1\"",
            "async": true,
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Mapping: `Read` → read, `Edit`/`Write` → write, `Grep` on a file → search, `Bash`/`PowerShell` → shell (note paths found in the command, relative paths resolved against `cd` targets and cwd).
In the live hook, a note named in a shell command or printed in its output that the command modified counts as write instead (`sed -i`, redirects, tools that print the path they wrote). Unmodified notes seen only in the output are ignored.

## Limits

- Files an agent loads without a tool call (`CLAUDE.md`, `@imports`) are not counted.
- `shell` means named in a command and not modified: a read, or only a mention (e.g. a path inside a tool's JSON input).
- The history import has no command output and files changed since, so all its shell notes stay `shell`.
- A note modified by something else within the write window right before a shell command names it counts as written by that command.
- Agents without hooks count only if they call `record` themselves.

## Tests

Pester 5+ (`Install-Module Pester -Scope CurrentUser -MinimumVersion 5.0`): `Invoke-Pester ./Tests`.
