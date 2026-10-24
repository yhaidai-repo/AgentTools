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

Describe 'ConvertFrom-ClaudeToolCall for shell commands with output' {
    BeforeEach {
        $notePath = Join-Path $vaultRoot 'note.md'
        $draftPath = Join-Path $vaultRoot 'draft.md'

        'x' | Set-Content $notePath
        'x' | Set-Content $draftPath
        (Get-Item $notePath).LastWriteTimeUtc = [datetime]::UtcNow.AddHours(-1)
    }

    It 'counts a note printed by the command and modified by it as a write' {
        $response = [pscustomobject]@{ stdout = "{""ok"":true,""path"":""$($draftPath.Replace('\', '\\'))""}"; stderr = '' }
        $toolCall = New-ClaudeToolCall -Id 't1' -Name 'Bash' -ToolInput ([pscustomobject]@{ command = 'vault-tool save' }) `
            -ToolResponse $response -Cwd $vaultRoot

        $fileUses = @(ConvertFrom-ClaudeToolCall -ToolCall $toolCall -Config $config)
        $written = $fileUses | Where-Object Kind -EQ 'write'

        $written.Paths | Should -Be @([IO.Path]::GetFullPath($draftPath))
    }

    It 'counts a note named in the command and modified by it as a write' {
        $toolCall = New-ClaudeToolCall -Id 't1' -Name 'Bash' -ToolInput ([pscustomobject]@{ command = 'sed -i s/x/y/ draft.md' }) `
            -ToolResponse ([pscustomobject]@{ stdout = '' }) -Cwd $vaultRoot

        $fileUses = @(ConvertFrom-ClaudeToolCall -ToolCall $toolCall -Config $config)

        ($fileUses | Where-Object Kind -EQ 'write').Paths.Count | Should -Be 1
        ($fileUses | Where-Object Kind -EQ 'shell').Paths.Count | Should -Be 0
    }

    It 'keeps an unmodified note named in the command as shell' {
        $toolCall = New-ClaudeToolCall -Id 't1' -Name 'Bash' -ToolInput ([pscustomobject]@{ command = 'cat note.md' }) `
            -ToolResponse ([pscustomobject]@{ stdout = 'x' }) -Cwd $vaultRoot

        $fileUses = @(ConvertFrom-ClaudeToolCall -ToolCall $toolCall -Config $config)

        ($fileUses | Where-Object Kind -EQ 'shell').Paths.Count | Should -Be 1
        ($fileUses | Where-Object Kind -EQ 'write').Paths.Count | Should -Be 0
    }

    It 'ignores an unmodified note that only appears in the output' {
        $toolCall = New-ClaudeToolCall -Id 't1' -Name 'Bash' -ToolInput ([pscustomobject]@{ command = 'ls' }) `
            -ToolResponse ([pscustomobject]@{ stdout = $notePath }) -Cwd $vaultRoot

        $fileUses = @(ConvertFrom-ClaudeToolCall -ToolCall $toolCall -Config $config)

        @($fileUses.Paths | Where-Object { $_ }).Count | Should -Be 0
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
