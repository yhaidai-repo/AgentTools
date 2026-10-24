BeforeAll {
    . (Join-Path $PSScriptRoot '..' 'Adapters' 'Codex' 'CodexToolUsage.ps1')

    $vaultRoot = Join-Path $TestDrive 'vault нотатки'

    New-Item -ItemType Directory -Path $vaultRoot -Force | Out-Null
    'old note' | Set-Content (Join-Path $vaultRoot 'note.md')
    (Get-Item (Join-Path $vaultRoot 'note.md')).LastWriteTimeUtc = [datetime]::UtcNow.AddHours(-1)

    $config = [pscustomobject]@{
        vaults = @([IO.Path]::GetFullPath($vaultRoot))
        extensions = @('.md')
        excludeFolders = @('.usage')
        logFolder = '.usage'
        logFile = 'usage.jsonl'
    }

    function New-TestCall {
        param([string]$Name, [object]$ToolInput, [object]$Response)

        return New-CodexToolCall -Id 'tool-1' -Name $Name -ToolInput $ToolInput -ToolResponse $Response -Cwd $vaultRoot -Session 'codex-session'
    }
}

# Synthetic edge cases supplement the real desktop captures tested below.
Describe 'Codex tool usage mapping' {
    It 'maps a canonical Bash payload to the shared shell scanner' {
        $payload = '{"tool_name":"Bash","tool_input":{"command":"cat note.md"},"tool_response":{"stdout":"old note"}}' | ConvertFrom-Json
        $call = New-TestCall -Name $payload.tool_name -ToolInput $payload.tool_input -Response $payload.tool_response
        $usage = @(ConvertFrom-CodexToolCall -ToolCall $call -Config $config)

        ($usage | Where-Object Kind -EQ 'shell').Paths | Should -Be @((Join-Path $vaultRoot 'note.md'))
        ($usage | Where-Object Kind -EQ 'write').Paths.Count | Should -Be 0
    }

    It 'supports the command and working directory from exec_command arguments' {
        $call = New-TestCall -Name 'exec_command' -ToolInput ([pscustomobject]@{ cmd = 'cat note.md'; workdir = $vaultRoot }) -Response 'old note'

        $usage = @(ConvertFrom-CodexToolCall -ToolCall $call -Config $config)

        ($usage | Where-Object Kind -EQ 'shell').Paths | Should -Be @((Join-Path $vaultRoot 'note.md'))
    }

    It 'records a recently changed shell note as a write' {
        $path = Join-Path $vaultRoot 'draft.md'

        'new' | Set-Content $path

        $call = New-TestCall -Name 'Bash' -ToolInput ([pscustomobject]@{ command = 'save draft.md' }) -Response 'done'
        $usage = @(ConvertFrom-CodexToolCall -ToolCall $call -Config $config)

        ($usage | Where-Object Kind -EQ 'write').Paths | Should -Be @($path)
    }

    It 'maps added updated deleted and moved patch paths even after deletion' {
        $patch = @"
*** Begin Patch
*** Add File: added note.md
+new
*** Update File: note.md
*** Move to: moved.md
@@
-old
+new
*** Delete File: gone.md
*** End Patch
"@
        $call = New-TestCall -Name 'apply_patch' -ToolInput ([pscustomobject]@{ command = $patch })
        $usage = ConvertFrom-CodexToolCall -ToolCall $call -Config $config
        $expected = @('added note.md', 'gone.md', 'moved.md', 'note.md') | ForEach-Object { Join-Path $vaultRoot $_ } | Sort-Object

        $usage.Kind | Should -Be 'write'
        $usage.Paths | Should -Be $expected
    }

    It 'does not duplicate PowerLoom MCP usage or record unrelated tools' -ForEach @(
        @{ Name = 'mcp__powerloom__status_get' }
        @{ Name = 'mcp__other__read' }
        @{ Name = 'update_plan' }
        @{ Name = 'exec' }
    ) {
        $call = New-TestCall -Name $Name -ToolInput ([pscustomobject]@{ command = 'cat note.md' })

        ConvertFrom-CodexToolCall -ToolCall $call -Config $config | Should -BeNullOrEmpty
    }

    It 'writes Codex agent session and event identifiers to the usage record' {
        $call = New-TestCall -Name 'Bash' -ToolInput ([pscustomobject]@{ command = 'cat note.md' })

        $record = Add-CodexToolUsage -ToolCall $call -Source 'hook' -Config $config

        $record.agent | Should -Be 'codex'
        $record.session | Should -Be 'codex-session'
        $record.eventId | Should -Be 'tool-1'
    }

    It 'never fails a tool call for a broken stdin payload' {
        $hookPath = Join-Path $PSScriptRoot '..' 'Adapters' 'Codex' 'Invoke-CodexHook.ps1'

        $output = 'bad json' | pwsh -NoProfile -NonInteractive -File $hookPath 2> $null

        $LASTEXITCODE | Should -Be 0
        $output | Should -BeNullOrEmpty
    }
}

Describe 'Captured desktop Codex hook payloads' {
    It 'records a real Bash payload through stdin with a Unicode working directory' {
        $fixturePath = Join-Path $PSScriptRoot '..' 'Adapters' 'Codex' 'Probe' 'Fixtures' 'bash.json'
        $payload = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
        $notePath = Join-Path $vaultRoot '.powerloom-hook-probe.tmp.md'
        $configPath = Join-Path $TestDrive 'codex-usage.json'
        $previousConfig = $env:VAULT_USAGE_CONFIG

        'captured note' | Set-Content -LiteralPath $notePath
        (Get-Item -LiteralPath $notePath).LastWriteTimeUtc = [datetime]::UtcNow.AddHours(-1)
        $config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath
        $payload.cwd = $vaultRoot
        $env:VAULT_USAGE_CONFIG = $configPath

        try {
            $hookPath = Join-Path $PSScriptRoot '..' 'Adapters' 'Codex' 'Invoke-CodexHook.ps1'
            $output = $payload | ConvertTo-Json -Depth 10 -Compress | pwsh -NoProfile -NonInteractive -File $hookPath

            $LASTEXITCODE | Should -Be 0
            $output | Should -BeNullOrEmpty

            $record = Get-Content -LiteralPath (Join-Path $vaultRoot '.usage' 'usage.jsonl') | ConvertFrom-Json | Where-Object eventId -EQ 'captured-call' | Select-Object -Last 1

            $record.agent | Should -Be 'codex'
            $record.kind | Should -Be 'shell'
            $record.file | Should -Be '.powerloom-hook-probe.tmp.md'
        }
        finally {
            $env:VAULT_USAGE_CONFIG = $previousConfig
        }
    }

    It 'maps a real completed patch deletion to a write even when the file is gone' {
        $fixturePath = Join-Path $PSScriptRoot '..' 'Adapters' 'Codex' 'Probe' 'Fixtures' 'apply-patch.json'
        $payload = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
        $call = New-TestCall -Name $payload.tool_name -ToolInput $payload.tool_input -Response $payload.tool_response

        $usage = ConvertFrom-CodexToolCall -ToolCall $call -Config $config

        $usage.Kind | Should -Be 'write'
        $usage.Paths | Should -Be @((Join-Path $vaultRoot '.powerloom-hook-probe.tmp.md'))
    }

    It 'ignores a captured unrelated MCP tool' {
        $fixturePath = Join-Path $PSScriptRoot '..' 'Adapters' 'Codex' 'Probe' 'Fixtures' 'mcp-other.json'
        $payload = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
        $call = New-TestCall -Name $payload.tool_name -ToolInput $payload.tool_input -Response $payload.tool_response

        ConvertFrom-CodexToolCall -ToolCall $call -Config $config | Should -BeNullOrEmpty
    }
}