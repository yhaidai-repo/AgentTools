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

Vault roots: `vault-capture.config.json`, or the file named by `VAULT_CAPTURE_CONFIG`. Projects are discovered: a top-level folder with a `<key>-index.md`.

## CLI

```bash
pwsh -NoProfile -File vault-capture.ps1 rules              # rules + how to capture, for agents
pwsh -NoProfile -File vault-capture.ps1 rules -Format json
```

```bash
echo '{"vault":"work-projects","project":"pvs","name":"pvs-topic","title":"Topic","source":"session finding","target":"[[pvs-index]]","captured":["fact"]}' | pwsh -NoProfile -File vault-capture.ps1 capture
```

Input JSON (stdin, or `-InputFile <path>`):

| Field | New draft | Append | Notes |
|---|---|---|---|
| `vault`, `project`, `name` | required | required | `name` = file name, kebab-case, unique in the vault |
| `title`, `target`, `source` | required | ignored | `source`: `user message`, `session finding`, `spec <id>` |
| `captured` | required | optional | bullets, one fact each |
| `sections` | optional | optional | `{ "Heading": ["bullet"] }` |
| `assumptions`, `toFill` | optional | optional | bullets |

Output: `{"ok":true,"mode":"created|appended|rejected","path":"…","errors":[]}`; exit code 1 when rejected.
An existing draft with the same name gets only the new bullets, in place. Rejected: unknown vault or project, name clash with a verified note, appending to a non-draft or another project's draft, more than `maxLines`.

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
