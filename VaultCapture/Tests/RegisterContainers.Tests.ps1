# Opt-in: actual C#/PowerShell protocol on one disposable shared mount, in separate IPC namespaces.
Describe 'Register locks across backend and runner containers' -Skip:($env:VAULT_CAPTURE_CONTAINER_TESTS -ne '1') {
    BeforeAll {
        $script:moduleRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
        $script:source = [IO.Path]::GetFullPath((Join-Path $moduleRoot '../PowerLoom/src/PowerLoom.Core/Infrastructure/Vaults/NoteLock.cs'))
        function Start-Actor([string]$Mode) {
            $name = "powerloom-register-test-$script:fixtureId-$($script:containers.Count)"
            $script:containers += $name
            docker run --detach --network none --name $name --label codex.fixture=powerloom-register-lock `
                --mount "type=bind,source=$script:root,target=/fixture" --mount "type=bind,source=$script:moduleRoot,target=/module,readonly" `
                --mount "type=bind,source=$script:source,target=/NoteLock.cs,readonly" `
                --entrypoint pwsh powerloom-app:latest -NoProfile -File /fixture/actor.ps1 $Mode | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Could not start disposable actor $Mode" }
            return $name
        }
        function Wait-Marker([string]$Name) {
            $deadline = [datetime]::UtcNow.AddSeconds(30)
            while (-not (Test-Path (Join-Path $script:root $Name))) {
                if ([datetime]::UtcNow -gt $deadline) { throw "Actor marker timed out: $Name" }
                Start-Sleep -Milliseconds 50
            }
        }
        function Finish-Actor([string]$Name) {
            $code = docker wait $Name
            if ($LASTEXITCODE -ne 0 -or "$code" -ne '0') { docker logs $Name; throw 'Disposable actor failed' }
        }
        function Read-Probe {
            $name = Start-Actor 'probe'
            Finish-Actor $name
            return Get-Content -Raw (Join-Path $script:root 'probe.json') | ConvertFrom-Json
        }
    }
    BeforeEach {
        $script:fixtureId = [guid]::NewGuid().ToString('N')
        $script:containers = @()
        $script:root = Join-Path $TestDrive $fixtureId
        New-Item -ItemType Directory (Join-Path $root 'pos') -Force | Out-Null
        @('---', 'project: pos', 'repo: /synthetic', '---') | Set-Content (Join-Path $root 'pos/pos-index.md')
        @('---', 'title: Synthetic register', '---', '# Issues') | Set-Content (Join-Path $root 'pos/pos-known-issues.md')
        @'
param([string]$Mode)
$ErrorActionPreference = 'Stop'
Import-Module /module/VaultCapture.psd1 -Force
$source = "#nullable enable`nusing System; using System.IO; using System.Threading; using System.Threading.Tasks;`n" + [IO.File]::ReadAllText('/NoteLock.cs')
Add-Type -TypeDefinition $source
function Wait-Release([string]$Mode) {
    [IO.File]::WriteAllText("/fixture/ready-$Mode", 'ready')
    $deadline = [datetime]::UtcNow.AddSeconds(180)
    while (-not [IO.File]::Exists("/fixture/release-$Mode")) {
        if ([datetime]::UtcNow -gt $deadline) { throw 'Holder safety timeout' }
        Start-Sleep -Milliseconds 50
    }
}
if ($Mode -eq 'csharp') {
    $held = [PowerLoom.Infrastructure.Vaults.NoteLock]::TryEnterAsync('/fixture/a.txt', [Threading.CancellationToken]::None, [timespan]::Zero).GetAwaiter().GetResult()
    if (-not $held) { throw 'C# holder did not acquire' }
    try { Wait-Release $Mode } finally { $held.Dispose() }
} elseif ($Mode -eq 'powershell') {
    $held = & (Get-Module VaultCapture) { Enter-RegisterLock -Lock /fixture/.b.txt.lock -TimeoutSeconds 0 }
    if (-not $held) { throw 'PowerShell holder did not acquire' }
    try { Wait-Release $Mode } finally { $held.Dispose() }
} elseif ($Mode -eq 'probe') {
    $ps = & (Get-Module VaultCapture) { Enter-RegisterLock -Lock /fixture/.a.txt.lock -TimeoutSeconds 0 }
    $cs = [PowerLoom.Infrastructure.Vaults.NoteLock]::TryEnterAsync('/fixture/b.txt', [Threading.CancellationToken]::None, [timespan]::Zero).GetAwaiter().GetResult()
    try { @{ powerShellEntered = [bool]$ps; cSharpEntered = [bool]$cs } | ConvertTo-Json | Set-Content /fixture/probe.json }
    finally { if ($ps) { $ps.Dispose() }; if ($cs) { $cs.Dispose() } }
} elseif ($Mode -like 'write*') {
    $deadline = [datetime]::UtcNow.AddSeconds(30)
    [IO.File]::WriteAllText("/fixture/ready-$Mode", 'ready')
    while (-not [IO.File]::Exists('/fixture/write-gate')) {
        if ([datetime]::UtcNow -gt $deadline) { throw 'Write gate timed out' }
        Start-Sleep -Milliseconds 50
    }
    $record = [pscustomobject]@{ vault = 'fixture'; project = 'pos'; kind = 'issues'; title = $Mode; text = 'Synthetic text.' }
    $result = Add-VaultRegisterRecord -InputObject $record -Config ([pscustomobject]@{ vaults = @('/fixture') })
    if (-not $result.ok) { throw ($result.errors -join '; ') }
    $result | ConvertTo-Json | Set-Content "/fixture/$Mode.json"
} else { throw 'Unknown actor mode' }
'@ | Set-Content (Join-Path $root 'actor.ps1')
    }
    AfterEach {
        foreach ($name in $script:containers) {
            if ($name -notmatch '^powerloom-register-test-[a-f0-9]+-\d+$') { throw 'Unexpected fixture identity' }
            docker rm --force $name | Out-Null
        }
    }
    It 'excludes both directions past sixty seconds and recovers only after actual holder death' {
        $cs = Start-Actor 'csharp'
        $ps = Start-Actor 'powershell'
        Wait-Marker 'ready-csharp'
        Wait-Marker 'ready-powershell'
        Start-Sleep -Seconds 62
        $busy = Read-Probe
        $busy.powerShellEntered | Should -BeFalse
        $busy.cSharpEntered | Should -BeFalse
        docker kill $cs | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not stop disposable C# holder' }
        $afterCsCrash = Read-Probe
        $afterCsCrash.powerShellEntered | Should -BeTrue
        $afterCsCrash.cSharpEntered | Should -BeFalse
        docker kill $ps | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not stop disposable PowerShell holder' }
        $afterBothCrash = Read-Probe
        $afterBothCrash.powerShellEntered | Should -BeTrue
        $afterBothCrash.cSharpEntered | Should -BeTrue
        Test-Path (Join-Path $root '.a.txt.lock') | Should -BeTrue
        Test-Path (Join-Path $root '.b.txt.lock') | Should -BeTrue
    }
    It 'preserves parallel register additions and unique IDs across containers' {
        $a = Start-Actor 'write1'
        $b = Start-Actor 'write2'
        Wait-Marker 'ready-write1'
        Wait-Marker 'ready-write2'
        [IO.File]::WriteAllText((Join-Path $root 'write-gate'), 'go')
        Finish-Actor $a
        Finish-Actor $b
        $ids = @((Get-Content -Raw (Join-Path $root 'write1.json') | ConvertFrom-Json).id, (Get-Content -Raw (Join-Path $root 'write2.json') | ConvertFrom-Json).id)
        ($ids | Sort-Object) | Should -Be @('KI-001', 'KI-002')
        $lines = [IO.File]::ReadAllLines((Join-Path $root 'pos/pos-known-issues.md'))
        @($lines | Where-Object { $_ -like '## KI-*' }).Count | Should -Be 2
        @($lines | Where-Object { $_ -match '^## KI-\d+ write[12]$' }).Count | Should -Be 2
    }
}
