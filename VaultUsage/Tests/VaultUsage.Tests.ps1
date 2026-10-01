BeforeAll {
    $modulePath = Join-Path $PSScriptRoot '..' 'VaultUsage.psd1'

    Import-Module $modulePath -Force
    . (Join-Path $PSScriptRoot '..' 'Cli' 'ConvertTo-ParameterTable.ps1')

    function New-TestVault {
        $vaultRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        New-Item -ItemType Directory -Path (Join-Path $vaultRoot 'sub'), (Join-Path $vaultRoot '.obsidian') -Force | Out-Null
        'x' | Set-Content (Join-Path $vaultRoot 'index.md')
        'x' | Set-Content (Join-Path $vaultRoot 'sub' 'note.md')
        'x' | Set-Content (Join-Path $vaultRoot 'never.md')
        'x' | Set-Content (Join-Path $vaultRoot '.obsidian' 'hidden.md')

        return $vaultRoot
    }

    function New-TestConfig {
        param([string]$VaultRoot)

        return [pscustomobject]@{
            vaults         = @([IO.Path]::GetFullPath($VaultRoot))
            extensions     = @('.md')
            excludeFolders = @('.obsidian', '.usage')
            logFolder      = '.usage'
            logFile        = 'usage.jsonl'
        }
    }
}

Describe 'Add-VaultUsage' {
    BeforeEach {
        $vaultRoot = New-TestVault
        $config = New-TestConfig -VaultRoot $vaultRoot
    }

    It 'records a vault note relative to the vault root' {
        $records = @(Add-VaultUsage -Path (Join-Path $vaultRoot 'sub' 'note.md') -Kind read -Agent codex -Config $config)

        $records.Count | Should -Be 1
        $records[0].file | Should -Be 'sub/note.md'
    }

    It 'skips excluded folders and paths outside the vault' {
        $paths = @((Join-Path $vaultRoot '.obsidian' 'hidden.md'), (Join-Path $TestDrive 'outside.md'))

        $records = @(Add-VaultUsage -Path $paths -Kind read -Agent codex -Config $config)

        $records.Count | Should -Be 0
    }

    It 'resolves relative paths against the cwd' {
        $records = @(Add-VaultUsage -Path 'index.md' -Cwd $vaultRoot -Kind write -Agent codex -Config $config)

        $records[0].file | Should -Be 'index.md'
    }

    It 'rejects an unknown kind' {
        { Add-VaultUsage -Path (Join-Path $vaultRoot 'index.md') -Kind open -Agent codex -Config $config } | Should -Throw
    }
}

Describe 'Find-VaultFileReference' {
    BeforeEach {
        $vaultRoot = New-TestVault
        $config = New-TestConfig -VaultRoot $vaultRoot
    }

    It 'finds notes after a cd and ignores missing files' {
        $command = "cd '$vaultRoot'; cat sub/note.md index.md missing.md"

        $paths = Find-VaultFileReference -Text $command -Config $config

        $paths.Count | Should -Be 2
    }

    It 'finds absolute note paths' {
        $paths = Find-VaultFileReference -Text "head -5 $(Join-Path $vaultRoot 'index.md')" -Config $config

        $paths | Should -Be (Join-Path ([IO.Path]::GetFullPath($vaultRoot)) 'index.md')
    }
}

Describe 'Get-VaultUsageReport' {
    BeforeEach {
        $vaultRoot = New-TestVault
        $config = New-TestConfig -VaultRoot $vaultRoot

        Add-VaultUsage -Path (Join-Path $vaultRoot 'index.md') -Kind read -Agent codex -Session s1 -Config $config | Out-Null
        Add-VaultUsage -Path (Join-Path $vaultRoot 'index.md') -Kind shell -Agent codex -Session s2 -Config $config | Out-Null
    }

    It 'counts usage per note' {
        $report = Get-VaultUsageReport -Format object -Config $config
        $index = $report.Notes | Where-Object File -EQ 'index.md'

        $index.Reads | Should -Be 1
        $index.Shell | Should -Be 1
        $index.Sessions | Should -Be 2
        $index.LastRead | Should -Not -BeNullOrEmpty
    }

    It 'lists unused notes with zero usage' {
        $report = Get-VaultUsageReport -Format object -Config $config
        $never = $report.Notes | Where-Object File -EQ 'never.md'

        $never.Total | Should -Be 0
    }

    It 'ignores usage before -Since' {
        $report = Get-VaultUsageReport -Format object -Since ([datetime]::UtcNow.AddDays(1)) -Config $config
        $index = $report.Notes | Where-Object File -EQ 'index.md'

        $index.Total | Should -Be 0
    }

    It 'marks logged notes that no longer exist' {
        Remove-Item (Join-Path $vaultRoot 'index.md')

        $report = Get-VaultUsageReport -Format object -Config $config
        $index = $report.Notes | Where-Object File -EQ 'index.md'

        $index.Exists | Should -BeFalse
    }
}

Describe 'Get-VaultUsageEventId' {
    It 'returns recorded event ids' {
        $vaultRoot = New-TestVault
        $config = New-TestConfig -VaultRoot $vaultRoot

        Add-VaultUsage -Path (Join-Path $vaultRoot 'index.md') -Kind read -Agent codex -EventId e1 -Config $config | Out-Null
        $eventIds = Get-VaultUsageEventId -Config $config

        $eventIds.Contains('e1') | Should -BeTrue
    }
}

Describe 'ConvertTo-ParameterTable' {
    It 'collects repeated names and switches' {
        $table = ConvertTo-ParameterTable -Arguments @('-Path', 'a.md', '-Path', 'b.md', '-Force', '-Kind', 'read')

        $table.Path | Should -Be @('a.md', 'b.md')
        $table.Force | Should -BeTrue
        $table.Kind | Should -Be 'read'
    }

    It 'rejects a value without a name' {
        { ConvertTo-ParameterTable -Arguments @('a.md') } | Should -Throw
    }
}
