BeforeAll {
    Import-Module (Join-Path $PSScriptRoot '..' 'VaultCapture.psd1') -Force

    function New-DraftVault {
        $vaultRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)

        New-Item -ItemType Directory -Path (Join-Path $vaultRoot 'draft') -Force | Out-Null

        return $vaultRoot
    }

    function Add-TestDraft {
        param(
            [Parameter(Mandatory)][string]$VaultRoot,
            [Parameter(Mandatory)][string]$Name,
            [Parameter(Mandatory)][string]$Captured,
            [Parameter(Mandatory)][string]$Source
        )

        $lines = @('---', "title: `"$Name`"", 'type: draft', 'project: pos', "captured: $Captured", "source: `"$Source`"", 'target: "[[pos-index]]"', '---', "# $Name")

        $lines | Set-Content (Join-Path $VaultRoot 'draft' "$Name.md")
    }
}

Describe 'Get-VaultDraft' {
    BeforeEach {
        $vaultRoot = New-DraftVault
        $config = [pscustomobject]@{ vaults = @([IO.Path]::GetFullPath($vaultRoot)) }
        $vaultName = Split-Path -Leaf $vaultRoot
    }

    It 'lists preferred-source drafts first, then the oldest first' {
        Add-TestDraft -VaultRoot $vaultRoot -Name 'pos-chat-old' -Captured '2026-09-01' -Source 'session finding'
        Add-TestDraft -VaultRoot $vaultRoot -Name 'pos-chat-new' -Captured '2026-09-20' -Source 'user message'
        Add-TestDraft -VaultRoot $vaultRoot -Name 'pos-pipeline' -Captured '2026-09-30' -Source 'session finding: powerloom AT-1 run RUN-2 (PBI-3)'

        $result = Get-VaultDraft -Vault $vaultName -PreferSource 'session finding: powerloom' -Config $config

        $result.ok | Should -BeTrue
        $result.drafts.name | Should -Be @('pos-pipeline', 'pos-chat-old', 'pos-chat-new')
        $result.drafts[0].preferred | Should -BeTrue
        $result.drafts[0].target | Should -Be '[[pos-index]]'
    }

    It 'returns no drafts when the draft folder is empty' {
        $result = Get-VaultDraft -Vault $vaultName -Config $config

        $result.ok | Should -BeTrue
        @($result.drafts).Count | Should -Be 0
    }

    It 'rejects an unknown vault' {
        $result = Get-VaultDraft -Vault 'nope' -Config $config

        $result.ok | Should -BeFalse
        $result.errors | Should -Contain "vault 'nope' is unknown."
    }
}

Describe 'Test-VaultDraft' {
    BeforeEach {
        $vaultRoot = New-DraftVault
        $config = [pscustomobject]@{ vaults = @([IO.Path]::GetFullPath($vaultRoot)) }
        $vaultName = Split-Path -Leaf $vaultRoot
    }

    It 'tells which names are still drafts' {
        Add-TestDraft -VaultRoot $vaultRoot -Name 'pos-open' -Captured '2026-09-01' -Source 'session finding'

        $result = Test-VaultDraft -Vault $vaultName -Name 'pos-open', 'pos-merged' -Config $config

        $result.ok | Should -BeTrue
        $result.drafts.'pos-open' | Should -BeTrue
        $result.drafts.'pos-merged' | Should -BeFalse
    }

    It 'rejects a name that is not a note name' {
        $result = Test-VaultDraft -Vault $vaultName -Name '../secret' -Config $config

        $result.ok | Should -BeFalse
        $result.errors | Should -Contain "name '../secret' is not a note name (kebab-case)."
    }

    It 'rejects an unknown vault' {
        $result = Test-VaultDraft -Vault 'nope' -Name 'pos-open' -Config $config

        $result.ok | Should -BeFalse
    }
}
