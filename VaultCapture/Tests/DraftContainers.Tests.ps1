# Opt-in: uses only uniquely named, network-isolated disposable containers and TestDrive fixtures.
Describe 'Draft locking across private container IPC namespaces' -Skip:($env:VAULT_CAPTURE_CONTAINER_TESTS -ne '1') {
    BeforeAll {
        $script:moduleRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
        Import-Module (Join-Path $moduleRoot 'VaultCapture.psd1') -Force
        function New-ContainerWriter([string]$Number, [string]$Mode = 'save') {
            $name = "powerloom-draft-test-$script:fixtureId-$Number"
            $script:containers += $name
            docker run --detach --network none --name $name --label codex.fixture=powerloom-draft-lock `
                --mount "type=bind,source=$script:root,target=/fixture" --mount "type=bind,source=$script:moduleRoot,target=/module,readonly" `
                --entrypoint pwsh powerloom-app:latest -NoProfile -File /fixture/writer.ps1 $Number $Mode | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Could not start disposable writer $Number" }
            return $name
        }
        function Open-WriterGate([string[]]$Numbers) {
            $deadline = [datetime]::UtcNow.AddSeconds(30)
            while (@($Numbers | Where-Object { -not (Test-Path (Join-Path $script:root "ready-$_")) }).Count) {
                if ([datetime]::UtcNow -gt $deadline) { throw 'Container writers did not become ready' }
                Start-Sleep -Milliseconds 50
            }
            [IO.File]::WriteAllText((Join-Path $script:root 'gate'), 'go')
        }
        function Read-WriterResult([string]$Name, [string]$Number) {
            $exitCode = docker wait $Name
            if ($LASTEXITCODE -ne 0 -or "$exitCode" -ne '0') { docker logs $Name; throw 'Disposable writer failed' }
            Get-Content -Raw (Join-Path $script:root "result-$Number.json") | ConvertFrom-Json
        }
        function Save-Seed([string[]]$Facts = @('Shared fact')) {
            Save-VaultCapture -InputObject ([pscustomobject]@{ vault = $script:root; project = 'pos'; name = 'pos-topic'; title = 'Topic'; source = 'session finding'; target = '[[pos-index]]'; captured = $Facts }) -Config ([pscustomobject]@{ vaults = @($script:root) })
        }
    }
    BeforeEach {
        $script:fixtureId = [guid]::NewGuid().ToString('N')
        $script:root = Join-Path $TestDrive $fixtureId
        $script:containers = @()
        New-Item -ItemType Directory (Join-Path $root 'pos'), (Join-Path $root 'draft') -Force | Out-Null
        @('---', 'project: pos', 'repo: /synthetic-repository', '---') | Set-Content (Join-Path $root 'pos/pos-index.md')
        $script:path = Join-Path $root 'draft/pos-topic.md'
        @'
param([string]$Number, [string]$Mode)
$ErrorActionPreference = 'Stop'
Import-Module /module/VaultCapture.psd1 -Force
& (Get-Module VaultCapture) {
    $script:actualRead = ${function:Read-DraftFile}
    function script:Read-DraftFile {
        param($Path, $Root, $ScopeRoot)
        $result = & $script:actualRead -Path $Path -Root $Root -ScopeRoot $ScopeRoot
        Start-Sleep -Milliseconds 750
        return $result
    }
}
[IO.File]::WriteAllText("/fixture/ready-$Number", 'ready')
$deadline = [datetime]::UtcNow.AddSeconds(30)
while (-not [IO.File]::Exists('/fixture/gate')) {
    if ([datetime]::UtcNow -gt $deadline) { throw 'Gate timed out' }
    Start-Sleep -Milliseconds 50
}
if ($Mode -eq 'hold') {
    & (Get-Module VaultCapture) {
        Use-DraftLock -Path /fixture/draft/pos-topic.md -Root /fixture -ScopeRoot /fixture/draft -Action {
            [IO.File]::WriteAllText('/fixture/holding', 'owned')
            Start-Sleep -Seconds 120
        }
    }
    exit
}
$inputData = [pscustomobject]@{ vault = 'fixture'; project = 'pos'; name = 'pos-topic'; title = 'Topic'; source = 'session finding'; target = '[[pos-index]]'; captured = @("Writer $Number", 'Shared fact', "Writer $Number") }
Save-VaultCapture -InputObject $inputData -Config ([pscustomobject]@{ vaults = @('/fixture') }) | ConvertTo-Json | Set-Content "/fixture/result-$Number.json"
'@ | Set-Content (Join-Path $root 'writer.ps1')
    }
    AfterEach {
        foreach ($name in $script:containers) {
            if ($name -notmatch '^powerloom-draft-test-[a-f0-9]+-[12h]$') { throw 'Unexpected fixture container identity' }
            docker rm --force $name | Out-Null
        }
    }
    It 'preserves overlapping successful create/append facts exactly once' -ForEach @(@{ Existing = $false }, @{ Existing = $true }) {
        if ($Existing) { (Save-Seed).ok | Should -BeTrue }
        $a = New-ContainerWriter '1'
        $b = New-ContainerWriter '2'
        Open-WriterGate @('1', '2')
        (Read-WriterResult $a '1').ok | Should -BeTrue
        (Read-WriterResult $b '2').ok | Should -BeTrue
        $lines = [IO.File]::ReadAllLines($path)
        foreach ($fact in @('Writer 1', 'Writer 2', 'Shared fact')) { @($lines | Where-Object { $_ -eq "- $fact" }).Count | Should -Be 1 }
    }
    It 'applies the size limit to the latest content across containers' {
        (Save-Seed).ok | Should -BeTrue
        $count = [IO.File]::ReadAllLines($path).Count
        (Save-Seed @(1..(79 - $count) | ForEach-Object { "Filler $_" })).ok | Should -BeTrue
        $a = New-ContainerWriter '1'
        $b = New-ContainerWriter '2'
        Open-WriterGate @('1', '2')
        $results = @((Read-WriterResult $a '1'), (Read-WriterResult $b '2'))
        @($results | Where-Object ok).Count | Should -Be 1
        [IO.File]::ReadAllLines($path).Count | Should -Be 80
    }
    It 'releases ownership after a crashed container without corrupting the prior draft' {
        (Save-Seed).ok | Should -BeTrue
        $before = [IO.File]::ReadAllText($path)
        $holder = New-ContainerWriter 'h' 'hold'
        Open-WriterGate @('h')
        $deadline = [datetime]::UtcNow.AddSeconds(20)
        while (-not (Test-Path (Join-Path $root 'holding'))) {
            if ([datetime]::UtcNow -gt $deadline) { throw 'Lock was not acquired' }
            Start-Sleep -Milliseconds 50
        }
        docker kill $holder | Out-Null
        [IO.File]::ReadAllText($path) | Should -BeExactly $before
        $a = New-ContainerWriter '1'
        $b = New-ContainerWriter '2'
        Open-WriterGate @('1', '2')
        (Read-WriterResult $a '1').ok | Should -BeTrue
        (Read-WriterResult $b '2').ok | Should -BeTrue
        [IO.File]::ReadAllLines($path) | Should -Contain '- Writer 1'
        [IO.File]::ReadAllLines($path) | Should -Contain '- Writer 2'
    }
}
