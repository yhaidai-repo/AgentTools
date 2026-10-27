BeforeAll {
    Import-Module (Join-Path $PSScriptRoot '..' 'VaultCapture.psd1') -Force
    function New-ScopeFixture {
        $root = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        New-Item -ItemType Directory -Path (Join-Path $root 'pos') -Force | Out-Null
        @('---', 'project: pos', 'repo: D:/synthetic-repo', '---') | Set-Content -LiteralPath (Join-Path $root 'pos/pos-index.md')
        @('---', 'title: Issues', '---', '# Issues') | Set-Content -LiteralPath (Join-Path $root 'pos/pos-known-issues.md')
        $config = [pscustomobject]@{ vaults = @($root) }
        $request = [pscustomobject]@{ vault = (Split-Path -Leaf $root); project = 'pos'; name = 'pos-topic'; title = 'Synthetic'; source = 'session finding'; target = '[[pos-index]]'; captured = @('Synthetic fact') }
        return @{ Root = $root; Config = $config; Request = $request }
    }
    function New-DirectoryAlias {
        param($Path, $Target)
        $kind = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }
        New-Item -ItemType $kind -Path $Path -Target $Target -ErrorAction Stop | Out-Null
    }
}

Describe 'VaultCapture physical file boundaries' {
    It 'keeps normal creation and append usable' {
        $fixture = New-ScopeFixture
        (Save-VaultCapture -InputObject $fixture.Request -Config $fixture.Config).mode | Should -Be 'created'
        $fixture.Request.captured = @('Second synthetic fact')
        (Save-VaultCapture -InputObject $fixture.Request -Config $fixture.Config).mode | Should -Be 'appended'
        Get-Content -LiteralPath (Join-Path $fixture.Root 'draft/pos-topic.md') | Should -Contain '- Second synthetic fact'
    }

    It 'rejects a draft directory alias outside the vault or into verified notes' {
        foreach ($inside in @($false, $true)) {
            $fixture = New-ScopeFixture
            $target = if ($inside) { Join-Path $fixture.Root 'verified' } else { Join-Path $TestDrive ([guid]::NewGuid().Guid) }
            New-Item -ItemType Directory -Path $target -Force | Out-Null
            $path = Join-Path $target 'pos-topic.md'
            [IO.File]::WriteAllText($path, 'SYNTHETIC ORIGINAL')
            New-DirectoryAlias -Path (Join-Path $fixture.Root 'draft') -Target $target
            $result = Save-VaultCapture -InputObject $fixture.Request -Config $fixture.Config
            $result.ok | Should -BeFalse
            [IO.File]::ReadAllText($path) | Should -Be 'SYNTHETIC ORIGINAL'
            (Get-VaultDraft -Vault $fixture.Request.vault -Config $fixture.Config).ok | Should -BeFalse
            (Test-VaultDraft -Vault $fixture.Request.vault -Name 'pos-topic' -Config $fixture.Config).ok | Should -BeFalse
        }
    }

    It 'rejects a draft leaf alias before reading or appending' {
        $fixture = New-ScopeFixture
        New-Item -ItemType Directory -Path (Join-Path $fixture.Root 'draft') | Out-Null
        $target = Join-Path $TestDrive 'outside-leaf.md'
        [IO.File]::WriteAllText($target, 'SYNTHETIC ORIGINAL')
        try { New-Item -ItemType SymbolicLink -Path (Join-Path $fixture.Root 'draft/pos-topic.md') -Target $target -ErrorAction Stop | Out-Null }
        catch { if ($IsWindows) { Set-ItResult -Skipped -Because 'Windows file-symlink privilege unavailable'; return }; throw }
        (Save-VaultCapture -InputObject $fixture.Request -Config $fixture.Config).ok | Should -BeFalse
        [IO.File]::ReadAllText($target) | Should -Be 'SYNTHETIC ORIGINAL'
    }

    It 'rejects register directory aliases without creating a lock or changing the destination' {
        foreach ($inside in @($false, $true)) {
        $fixture = New-ScopeFixture
        $target = if ($inside) { Join-Path $fixture.Root 'verified' } else { Join-Path $TestDrive ([guid]::NewGuid().Guid) }
        New-Item -ItemType Directory -Path $target | Out-Null
        $path = Join-Path $target 'other-known-issues.md'
        [IO.File]::WriteAllText($path, 'SYNTHETIC ORIGINAL')
        New-DirectoryAlias -Path (Join-Path $fixture.Root 'other') -Target $target
        $record = [pscustomobject]@{ vault = $fixture.Request.vault; project = 'other'; kind = 'issues'; title = 'Synthetic'; text = 'Synthetic' }
        (Add-VaultRegisterRecord -InputObject $record -Config $fixture.Config).ok | Should -BeFalse
        (Get-VaultRegister -Vault $fixture.Request.vault -Project 'other' -Kind 'issues' -Config $fixture.Config).ok | Should -BeFalse
        [IO.File]::ReadAllText($path) | Should -Be 'SYNTHETIC ORIGINAL'
        Test-Path -LiteralPath (Join-Path $target '.other-known-issues.md.lock') | Should -BeFalse
        }
    }

    It 'rejects a register leaf alias without changing its destination' {
        $fixture = New-ScopeFixture
        $target = Join-Path $TestDrive 'register-original.md'
        [IO.File]::WriteAllText($target, 'SYNTHETIC ORIGINAL')
        $path = Join-Path $fixture.Root 'pos/pos-open-questions.md'
        try { New-Item -ItemType SymbolicLink -Path $path -Target $target -ErrorAction Stop | Out-Null }
        catch { if ($IsWindows) { Set-ItResult -Skipped -Because 'Windows file-symlink privilege unavailable'; return }; throw }
        $record = [pscustomobject]@{ vault = $fixture.Request.vault; project = 'pos'; kind = 'questions'; title = 'Synthetic'; text = 'Synthetic' }
        (Add-VaultRegisterRecord -InputObject $record -Config $fixture.Config).ok | Should -BeFalse
        [IO.File]::ReadAllText($target) | Should -Be 'SYNTHETIC ORIGINAL'
    }
}
