# Codex hook payload probe

This diagnostic hook appends each stdin JSON payload as one compact JSON line.
It produces no output and exits 0 even when the input or log path is invalid.

The default log is ~/.vault-usage/codex-probe.jsonl. Set
CODEX_HOOK_PROBE_LOG in the environment inherited by Codex to override it.

## Install only with the user's approval

Add these entries to ~/.codex/hooks.json, preserving all existing entries:

~~~json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -NonInteractive -File \"D:/Projects/AgentTools-wt/feature/openai-codex/VaultUsage/Adapters/Codex/Probe/Write-HookPayload.ps1\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -NonInteractive -File \"D:/Projects/AgentTools-wt/feature/openai-codex/VaultUsage/Adapters/Codex/Probe/Write-HookPayload.ps1\""
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "pwsh -NoProfile -NonInteractive -File \"D:/Projects/AgentTools-wt/feature/openai-codex/VaultUsage/Adapters/Codex/Probe/Write-HookPayload.ps1\""
          }
        ]
      }
    ]
  }
}
~~~

Review and trust these hooks through /hooks. Use one Codex session to:

1. Read a vault note through a shell command.
2. Edit a disposable vault note with apply_patch.
3. Call a powerloom MCP tool.
4. Let Codex stop so the Stop event is captured.

PreCompact is optional: capture it when compaction naturally occurs.
The log contains tool input/output and local paths; inspect it before sharing.
Remove only these probe entries after capture; keep unrelated hooks.

## Verify without installing

Run Invoke-Pester ./VaultUsage/Adapters/Codex/Probe/Probe.Tests.ps1.
The tests launch the script as a child process and use temporary log files.

## Captured fixtures (2026-10-24)

Fixtures/ holds shortened real desktop payloads: Bash, apply_patch, an unrelated
MCP tool, and Stop. IDs, absolute user paths and unrelated tool contents are
redacted; field names and relevant tool input/output shapes are retained.
The shell and patch captures came from a disposable note created and removed
during this implementation. No real PowerLoom MCP payload or PreCompact
payload has been captured; PowerLoom tool exclusion has a synthetic test.

The desktop normalizes nested exec_command calls to Bash with a command field,
and passes shell/patch responses as strings. Stop includes stop_hook_active.
Explicit UTF-8 Console input/output is required for Cyrillic paths on this PC.