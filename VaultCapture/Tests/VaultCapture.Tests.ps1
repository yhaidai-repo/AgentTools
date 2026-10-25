BeforeAll {
    Import-Module (Join-Path $PSScriptRoot '..' 'VaultCapture.psd1') -Force

    function New-TestVault {
        $vaultRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $script:RepoRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        New-Item -ItemType Directory -Path (Join-Path $vaultRoot 'pos' 'feature'), (Join-Path $vaultRoot 'draft'), (Join-Path $vaultRoot 'backlog') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $script:RepoRoot 'src') -Force | Out-Null
        @('---', 'project: pos', "repo: $($script:RepoRoot.Replace('\', '/'))", '---') | Set-Content (Join-Path $vaultRoot 'pos' 'pos-index.md')
        @('---', 'title: "Backlog"', '---') | Set-Content (Join-Path $vaultRoot 'backlog' 'backlog-index.md')
        'x' | Set-Content (Join-Path $vaultRoot 'pos' 'feature' 'pos-taken.md')

        return $vaultRoot
    }

    function New-TestConfig {
        param([string]$VaultRoot)

        return [pscustomobject]@{
            vaults = @([IO.Path]::GetFullPath($VaultRoot))
        }
    }

    function New-TestInput {
        param([hashtable]$Override = @{})

        $values = @{
            vault    = $script:VaultName
            project  = 'pos'
            name     = 'pos-topic'
            title    = 'Topic'
            source   = 'session finding'
            target   = '[[pos-index]]'
            captured = @('First fact')
        }

        foreach ($key in $Override.Keys) {
            $values[$key] = $Override[$key]
        }

        return [pscustomobject]$values
    }
}

Describe 'Save-VaultCapture' {
    BeforeEach {
        $vaultRoot = New-TestVault
        $config = New-TestConfig -VaultRoot $vaultRoot
        $script:VaultName = Split-Path -Leaf $vaultRoot
        $draftPath = Join-Path $vaultRoot 'draft' 'pos-topic.md'
    }

    It 'creates a draft with the vault template' {
        $result = Save-VaultCapture -InputObject (New-TestInput) -Config $config
        $content = Get-Content -LiteralPath $draftPath

        $result.ok | Should -BeTrue
        $result.mode | Should -Be 'created'
        $content | Should -Contain 'type: draft'
        $content | Should -Contain 'project: pos'
        $content | Should -Contain '## Captured'
        $content | Should -Contain '## To fill'
    }

    It 'appends new bullets to an existing draft and skips duplicates' {
        Save-VaultCapture -InputObject (New-TestInput) -Config $config | Out-Null

        $result = Save-VaultCapture -InputObject (New-TestInput -Override @{ captured = @('First fact', 'Second fact') }) -Config $config
        $content = Get-Content -LiteralPath $draftPath

        $result.mode | Should -Be 'appended'
        @($content | Where-Object { $_ -eq '- First fact' }).Count | Should -Be 1
        $content | Should -Contain '- Second fact'
    }

    It 'adds a new section before To fill' {
        Save-VaultCapture -InputObject (New-TestInput) -Config $config | Out-Null

        Save-VaultCapture -InputObject (New-TestInput -Override @{ assumptions = @('Same in prod (assumption)') }) -Config $config | Out-Null
        $content = @(Get-Content -LiteralPath $draftPath)

        [array]::IndexOf($content, '## Assumptions') | Should -BeLessThan ([array]::IndexOf($content, '## To fill'))
    }

    It 'rejects <Case>' -ForEach @(
        @{ Case = 'an unknown project'; Override = @{ project = 'nope' } }
        @{ Case = 'a name used by a verified note'; Override = @{ name = 'pos-taken' } }
        @{ Case = 'a name that is not kebab-case'; Override = @{ name = 'Pos Topic' } }
        @{ Case = 'an unknown source'; Override = @{ source = 'web search' } }
        @{ Case = 'a new draft without target'; Override = @{ target = $null } }
        @{ Case = 'no bullets'; Override = @{ captured = @() } }
        @{ Case = 'an unknown vault'; Override = @{ vault = 'other' } }
        @{ Case = 'a note file path as target'; Override = @{ target = 'pos/pos-index.md' } }
        @{ Case = 'a note file path in a bullet'; Override = @{ captured = @('See D:/vault/pos/pos-index.md for details') } }
    ) {
        $result = Save-VaultCapture -InputObject (New-TestInput -Override $Override) -Config $config

        $result.ok | Should -BeFalse
        $result.errors | Should -Not -BeNullOrEmpty
        Test-Path -LiteralPath $draftPath | Should -BeFalse
    }

    It 'accepts [[note]] links and folder targets' {
        $captureInput = New-TestInput -Override @{ target = 'pos/feature'; captured = @('Same as [[pos-index]]') }

        $result = Save-VaultCapture -InputObject $captureInput -Config $config

        $result.ok | Should -BeTrue
    }

    It 'rejects a draft over the line limit' {
        $bullets = 1..90 | ForEach-Object { "Fact $_" }

        $result = Save-VaultCapture -InputObject (New-TestInput -Override @{ captured = $bullets }) -Config $config

        $result.ok | Should -BeFalse
        Test-Path -LiteralPath $draftPath | Should -BeFalse
    }
}

Describe 'Save-VaultCapture in a project repository' {
    BeforeEach {
        $vaultRoot = New-TestVault
        $config = New-TestConfig -VaultRoot $vaultRoot
        $script:VaultName = Split-Path -Leaf $vaultRoot
        $cwd = Join-Path $script:RepoRoot 'src'
    }

    It 'fills vault and project from the working directory' {
        $captureInput = New-TestInput -Override @{ vault = $null; project = $null }

        $result = Save-VaultCapture -InputObject $captureInput -Cwd $cwd -Config $config
        $content = Get-Content -LiteralPath $result.path

        $result.ok | Should -BeTrue
        $content | Should -Contain 'project: pos'
    }

    It 'rejects a capture for another project' {
        $result = Save-VaultCapture -InputObject (New-TestInput -Override @{ project = 'posi' }) -Cwd $cwd -Config $config

        $result.ok | Should -BeFalse
        $result.errors | Should -Match "works on project 'pos'"
    }

    It 'resolves a git worktree to its main repository' -Skip:(-not (Get-Command git -ErrorAction SilentlyContinue)) {
        $worktree = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        git -C $script:RepoRoot init -q
        git -C $script:RepoRoot -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
        git -C $script:RepoRoot worktree add -q $worktree
        New-Item -ItemType Directory -Path (Join-Path $worktree 'src') -Force | Out-Null

        $result = Save-VaultCapture -InputObject (New-TestInput -Override @{ vault = $null; project = $null }) -Cwd (Join-Path $worktree 'src') -Config $config

        $result.ok | Should -BeTrue
    }
}

Describe 'Get-CaptureInstruction' {
    BeforeEach {
        $vaultRoot = New-TestVault
        $config = New-TestConfig -VaultRoot $vaultRoot
    }

    It 'lists the rules, the projects with a repository and the capture command' {
        $instruction = Get-CaptureInstruction -Reason 'Test.' -Config $config

        $instruction | Should -Match 'Vault rules:'
        $instruction | Should -Match "(?m)^- $(Split-Path -Leaf $vaultRoot): pos\r?$"
        $instruction | Should -Not -Match 'backlog'
        $instruction | Should -Match 'vault-capture.ps1" capture'
    }

    It 'names the session project when the working directory is in its repository' {
        $instruction = Get-CaptureInstruction -Reason 'Test.' -Cwd (Join-Path $script:RepoRoot 'src') -Config $config

        $instruction | Should -Match 'This session works on project pos'
        $instruction | Should -Not -Match '"project":'
    }
}
