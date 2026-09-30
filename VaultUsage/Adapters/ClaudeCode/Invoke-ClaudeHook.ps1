<#
.SYNOPSIS
    Claude Code PostToolUse hook adapter. Reads the hook JSON from stdin and records vault usage.
.NOTES
    Never fails the agent's tool call: errors go to stderr and the exit code stays 0.
#>
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ClaudeToolUsage.ps1')

function Invoke-ClaudeHook {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $toolCall = New-ClaudeToolCall -Id $payload.tool_use_id -Name $payload.tool_name -ToolInput $payload.tool_input `
        -Cwd $payload.cwd -Session $payload.session_id -Subagent $payload.agent_type

    Add-ClaudeToolUsage -ToolCall $toolCall -Source 'hook' -Config (Get-VaultUsageConfig) | Out-Null
}

try {
    Invoke-ClaudeHook
}
catch {
    [Console]::Error.WriteLine("vault-usage hook: $_")
}

exit 0
