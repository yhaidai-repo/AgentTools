BeforeAll {
    Import-Module (Join-Path $PSScriptRoot '..' 'VaultCapture.psd1') -Force

    function New-RegisterVault {
        $vaultRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $projectRoot = Join-Path $vaultRoot 'pos'

        New-Item -ItemType Directory -Path $projectRoot -Force | Out-Null
        @('---', 'project: pos', 'repo: D:/Projects/POS', '---') | Set-Content (Join-Path $projectRoot 'pos-index.md')
        @(
            '---', 'title: Open questions', '---', '# Open questions', '',
            '## OQ-001', '**Older layout title**', '> **Open** · Created 2026-09-23 · Updated 2026-09-23', '',
            '## [RESOLVED] OQ-002 Rule layout title', '> **Resolved** · Created 2026-09-24 · Updated 2026-09-25'
        ) | Set-Content (Join-Path $projectRoot 'pos-open-questions.md')
        @('---', 'title: Known issues', '---', '# Known issues') | Set-Content (Join-Path $projectRoot 'pos-known-issues.md')

        return $vaultRoot
    }
}

Describe 'Get-VaultRegister' {
    BeforeEach {
        $vaultRoot = New-RegisterVault
        $config = [pscustomobject]@{ vaults = @([IO.Path]::GetFullPath($vaultRoot)) }
        $vaultName = Split-Path -Leaf $vaultRoot
    }

    It 'reads records in both layouts' {
        $result = Get-VaultRegister -Vault $vaultName -Project 'pos' -Kind 'questions' -Config $config

        $result.ok | Should -BeTrue
        $result.records.id | Should -Be @('OQ-001', 'OQ-002')
        $result.records[0].title | Should -Be 'Older layout title'
        $result.records[1].title | Should -Be 'Rule layout title'
        $result.records[1].resolved | Should -BeTrue
        $result.records[1].status | Should -Be 'Resolved'
    }

    It 'reads an empty register' {
        $result = Get-VaultRegister -Vault $vaultName -Project 'pos' -Kind 'issues' -Config $config

        $result.ok | Should -BeTrue
        @($result.records).Count | Should -Be 0
    }

    It 'rejects an unknown kind or project' {
        (Get-VaultRegister -Vault $vaultName -Project 'pos' -Kind 'todos' -Config $config).ok | Should -BeFalse
        (Get-VaultRegister -Vault $vaultName -Project 'nope' -Kind 'issues' -Config $config).errors | Should -Contain "project 'nope' has no known-issues register."
    }
}

Describe 'Add-VaultRegisterRecord' {
    BeforeEach {
        $vaultRoot = New-RegisterVault
        $config = [pscustomobject]@{ vaults = @([IO.Path]::GetFullPath($vaultRoot)) }
        $vaultName = Split-Path -Leaf $vaultRoot
    }

    It 'records supplied work context and prefers the actual chat over its session' {
        $record = [pscustomobject]@{ vault = $vaultName; project = 'pos'; kind = 'issues'; title = 'Context'; text = 'Known facts'; context = [pscustomobject]@{ pbiId = 7; taskId = 'TT-7-001'; chatId = 'codex-123'; sessionId = 'mcp-456' } }
        $result = Add-VaultRegisterRecord -InputObject $record -Config $config
        $content = Get-Content -LiteralPath (Join-Path $vaultRoot 'pos' 'pos-known-issues.md') -Raw
        $result.ok | Should -BeTrue
        $content | Should -Match '- Created in: \d{4}-\d{2}-\d{2} · pbi:7 · task:TT-7-001 · chat:codex-123'
        $content | Should -Not -Match 'mcp-456'
    }

    It 'refuses context that could inject a record heading' {
        $record = [pscustomobject]@{ vault = $vaultName; project = 'pos'; kind = 'issues'; title = 'Context'; text = 'Known facts'; context = [pscustomobject]@{ chatId = "bad`n## KI-999 Fake" } }
        (Add-VaultRegisterRecord -InputObject $record -Config $config).ok | Should -BeFalse
        $record.context = [pscustomobject]@{ pbiId = "7`n" }
        (Add-VaultRegisterRecord -InputObject $record -Config $config).ok | Should -BeFalse
    }

    It 'appends the next question in the rule layout' {
        $record = [pscustomobject]@{ vault = $vaultName; project = 'pos'; kind = 'questions'; title = 'Which states?'; text = 'Only MA, MD?'; default = @('MA and MD only'); options = @('Keep', 'Extend') }

        $result = Add-VaultRegisterRecord -InputObject $record -Config $config
        $content = Get-Content -LiteralPath (Join-Path $vaultRoot 'pos' 'pos-open-questions.md')

        $result.ok | Should -BeTrue
        $result.id | Should -Be 'OQ-003'
        $content | Should -Contain '## OQ-003 Which states?'
        ($content | Where-Object { $_ -like '> **Open** · Created *' }).Count | Should -Be 2
        $content | Should -Contain '**Question**: Only MA, MD?'
        $content | Should -Contain '- MA and MD only'
        $content | Should -Contain '2. Extend'
    }

    It 'starts an empty register at 001 with the issue label' {
        $record = [pscustomobject]@{ vault = $vaultName; project = 'pos'; kind = 'issues'; title = 'Wrong total'; text = 'Sums twice.' }

        $result = Add-VaultRegisterRecord -InputObject $record -Config $config

        $result.id | Should -Be 'KI-001'
        Get-Content -LiteralPath (Join-Path $vaultRoot 'pos' 'pos-known-issues.md') | Should -Contain '**Issue**: Sums twice.'
    }

    It 'rejects a record without title or text' {
        $record = [pscustomobject]@{ vault = $vaultName; project = 'pos'; kind = 'issues'; title = ''; text = 'x' }

        $result = Add-VaultRegisterRecord -InputObject $record -Config $config

        $result.ok | Should -BeFalse
        $result.errors | Should -Contain 'title is required.'
    }

    It 'rejects a title, a default or an option over two lines, and a heading line in the text' {
        $record = [pscustomobject]@{ vault = $vaultName; project = 'pos'; kind = 'issues'; title = "Wrong total`n## KI-999 Fake"; text = "Sums twice.`n## KI-998 Fake"; default = @("a`nb"); options = @() }

        $result = Add-VaultRegisterRecord -InputObject $record -Config $config

        $result.ok | Should -BeFalse
        $result.errors | Should -Contain 'title is one line.'
        $result.errors | Should -Contain 'each default and option is one line.'
        $result.errors | Should -Contain 'text has no heading lines (a line starting with #): it would start a record of its own.'
        Get-Content -LiteralPath (Join-Path $vaultRoot 'pos' 'pos-known-issues.md') | Should -Not -Contain '## KI-999 Fake'
    }

    It 'keeps a text over several lines' {
        $record = [pscustomobject]@{ vault = $vaultName; project = 'pos'; kind = 'issues'; title = 'Wrong total'; text = "Sums twice.`nSee #42 in the log." }

        (Add-VaultRegisterRecord -InputObject $record -Config $config).ok | Should -BeTrue
    }
}

Describe 'Register lock' {
    BeforeEach {
        $vaultRoot = New-RegisterVault
        $config = [pscustomobject]@{ vaults = @([IO.Path]::GetFullPath($vaultRoot)) }
        $vaultName = Split-Path -Leaf $vaultRoot
        $lock = Join-Path $vaultRoot 'pos' '.pos-known-issues.md.lock'
        $record = [pscustomobject]@{ vault = $vaultName; project = 'pos'; kind = 'issues'; title = 'Wrong total'; text = 'Sums twice.' }
    }

    It 'leaves an unowned persistent lock file after an add' {
        (Add-VaultRegisterRecord -InputObject $record -Config $config).ok | Should -BeTrue

        Test-Path -LiteralPath $lock | Should -BeTrue
        $handle = [IO.File]::Open($lock, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        $handle.Dispose()
    }

    It 'gives every one of parallel adds its own id' {
        $module = Join-Path $PSScriptRoot '..' 'VaultCapture.psd1'
        $jobs = 1..4 | ForEach-Object {
            Start-ThreadJob -ArgumentList $module, $record, $config -ScriptBlock {
                param($module, $record, $config)
                Import-Module $module -Force
                Add-VaultRegisterRecord -InputObject $record -Config $config
            }
        }
        $results = @($jobs | Wait-Job | Receive-Job)
        $content = Get-Content -LiteralPath (Join-Path $vaultRoot 'pos' 'pos-known-issues.md')

        @($results | Where-Object ok).Count | Should -Be 4 -Because ($results.errors -join '; ')
        ($results.id | Sort-Object) | Should -Be @('KI-001', 'KI-002', 'KI-003', 'KI-004')
        @($content | Where-Object { $_ -like '## KI-*' }).Count | Should -Be 4
    }

    It 'answers busy for an aged live owner and reuses its file after release' {
        [IO.File]::WriteAllText($lock, '')
        (Get-Item -LiteralPath $lock -Force).LastWriteTimeUtc = [DateTime]::UtcNow.AddMinutes(-5)
        $handle = [IO.File]::Open($lock, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)

        try {
            $busy = InModuleScope VaultCapture -Parameters @{ Path = (Join-Path $vaultRoot 'pos' 'pos-known-issues.md') } {
                param($Path)
                Use-RegisterLock -Path $Path -Root (Split-Path -Parent $Path) -TimeoutSeconds 0 -Action { 'written' }
            }
        } finally {
            $handle.Dispose()
        }
        $taken = InModuleScope VaultCapture -Parameters @{ Path = (Join-Path $vaultRoot 'pos' 'pos-known-issues.md') } {
            param($Path)
            Use-RegisterLock -Path $Path -Root (Split-Path -Parent $Path) -TimeoutSeconds 0 -Action { 'written' }
        }
        $result = Add-VaultRegisterRecord -InputObject $record -Config $config

        $taken | Should -Be 'written'
        $busy.ok | Should -BeFalse
        $busy.errors | Should -Contain 'the register is being written by another process: try again in a moment.'
        $result.id | Should -Be 'KI-001'
        Test-Path -LiteralPath $lock | Should -BeTrue
    }
}
