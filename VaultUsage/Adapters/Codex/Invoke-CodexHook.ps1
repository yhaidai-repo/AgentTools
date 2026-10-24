$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)


. (Join-Path $PSScriptRoot 'CodexToolUsage.ps1')

function Invoke-CodexHook {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $parameters = @{
        Id = $payload.tool_use_id
        Name = $payload.tool_name
        ToolInput = $payload.tool_input
        ToolResponse = $payload.tool_response
        Cwd = $payload.cwd
        Session = $payload.session_id
    }
    $toolCall = New-CodexToolCall @parameters

    Add-CodexToolUsage -ToolCall $toolCall -Source 'hook' -Config (Get-VaultUsageConfig) | Out-Null
}

try {
    Invoke-CodexHook
}
catch {
    [Console]::Error.WriteLine("vault-usage Codex hook: $_")
}

exit 0
