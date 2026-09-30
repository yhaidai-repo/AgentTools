BeforeAll {
    . (Join-Path $PSScriptRoot '..' 'Adapters' 'ClaudeCode' 'ClaudeToolUsage.ps1')

    $vaultRoot = Join-Path $TestDrive 'vault'

    New-Item -ItemType Directory -Path $vaultRoot -Force | Out-Null
    'x' | Set-Content (Join-Path $vaultRoot 'index.md')

    $config = [pscustomobject]@{
        vaults         = @([IO.Path]::GetFullPath($vaultRoot))
        extensions     = @('.md')
        excludeFolders = @('.usage')
        logFolder      = '.usage'
        logFile        = 'usage.jsonl'
    }
}

Describe 'ConvertFrom-ClaudeToolCall' {
    It 'maps <Name> to <Kind>' -ForEach @(
        @{ Name = 'Read'; ToolInput = @{ file_path = 'index.md' }; Kind = 'read' }
        @{ Name = 'Edit'; ToolInput = @{ file_path = 'index.md' }; Kind = 'write' }
        @{ Name = 'Grep'; ToolInput = @{ path = 'index.md' }; Kind = 'search' }
        @{ Name = 'Bash'; ToolInput = @{ command = 'cat index.md' }; Kind = 'shell' }
    ) {
        $toolCall = New-ClaudeToolCall -Id 't1' -Name $Name -ToolInput ([pscustomobject]$ToolInput) -Cwd $vaultRoot

        $fileUse = ConvertFrom-ClaudeToolCall -ToolCall $toolCall -Config $config

        $fileUse.Kind | Should -Be $Kind
    }

    It 'ignores tools that do not touch files' {
        $toolCall = New-ClaudeToolCall -Id 't1' -Name 'AskUserQuestion' -ToolInput ([pscustomobject]@{})

        ConvertFrom-ClaudeToolCall -ToolCall $toolCall -Config $config | Should -BeNullOrEmpty
    }
}

Describe 'Add-ClaudeToolUsage' {
    It 'records the subagent and event id' {
        $toolCall = New-ClaudeToolCall -Id 't9' -Name 'Read' -ToolInput ([pscustomobject]@{ file_path = 'index.md' }) `
            -Cwd $vaultRoot -Session 's1' -Subagent 'Explore'

        $record = Add-ClaudeToolUsage -ToolCall $toolCall -Source 'hook' -Config $config

        $record.subagent | Should -Be 'Explore'
        $record.eventId | Should -Be 't9'
    }
}
