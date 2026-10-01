BeforeAll {
    Import-Module (Join-Path $PSScriptRoot '..' 'VaultCapture.psd1') -Force

    function New-TestVault {
        $vaultRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        New-Item -ItemType Directory -Path (Join-Path $vaultRoot 'pvs' 'feature'), (Join-Path $vaultRoot 'draft') -Force | Out-Null
        'x' | Set-Content (Join-Path $vaultRoot 'pvs' 'pvs-index.md')
        'x' | Set-Content (Join-Path $vaultRoot 'pvs' 'feature' 'pvs-taken.md')

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
            project  = 'pvs'
            name     = 'pvs-topic'
            title    = 'Topic'
            source   = 'session finding'
            target   = '[[pvs-index]]'
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
        $draftPath = Join-Path $vaultRoot 'draft' 'pvs-topic.md'
    }

    It 'creates a draft with the vault template' {
        $result = Save-VaultCapture -InputObject (New-TestInput) -Config $config
        $content = Get-Content -LiteralPath $draftPath

        $result.ok | Should -BeTrue
        $result.mode | Should -Be 'created'
        $content | Should -Contain 'type: draft'
        $content | Should -Contain 'project: pvs'
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
        @{ Case = 'a name used by a verified note'; Override = @{ name = 'pvs-taken' } }
        @{ Case = 'a name that is not kebab-case'; Override = @{ name = 'Pvs Topic' } }
        @{ Case = 'an unknown source'; Override = @{ source = 'web search' } }
        @{ Case = 'a new draft without target'; Override = @{ target = $null } }
        @{ Case = 'no bullets'; Override = @{ captured = @() } }
        @{ Case = 'an unknown vault'; Override = @{ vault = 'other' } }
        @{ Case = 'a note file path as target'; Override = @{ target = 'pvs/pvs-index.md' } }
        @{ Case = 'a note file path in a bullet'; Override = @{ captured = @('See D:/vault/pvs/pvs-index.md for details') } }
    ) {
        $result = Save-VaultCapture -InputObject (New-TestInput -Override $Override) -Config $config

        $result.ok | Should -BeFalse
        $result.errors | Should -Not -BeNullOrEmpty
        Test-Path -LiteralPath $draftPath | Should -BeFalse
    }

    It 'accepts [[note]] links and folder targets' {
        $captureInput = New-TestInput -Override @{ target = 'pvs/feature'; captured = @('Same as [[pvs-index]]') }

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

Describe 'Get-CaptureInstruction' {
    It 'lists the rules, the projects and the capture command' {
        $vaultRoot = New-TestVault
        $config = New-TestConfig -VaultRoot $vaultRoot

        $instruction = Get-CaptureInstruction -Reason 'Test.' -Config $config

        $instruction | Should -Match 'Vault rules:'
        $instruction | Should -Match "$(Split-Path -Leaf $vaultRoot): pvs"
        $instruction | Should -Match 'vault-capture.ps1" capture'
    }
}
