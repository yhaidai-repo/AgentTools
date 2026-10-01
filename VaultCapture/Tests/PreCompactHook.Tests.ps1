BeforeAll {
    $script:HookPath = Join-Path $PSScriptRoot '..' 'Adapters' 'ClaudeCode' 'Invoke-PreCompactHook.ps1'

    function Invoke-Hook {
        param([string]$Payload)

        $errorFile = Join-Path $TestDrive 'stderr.txt'
        $Payload | pwsh -NoProfile -File $script:HookPath 2> $errorFile | Out-Null

        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Stderr   = Get-Content -LiteralPath $errorFile -Raw
        }
    }
}

Describe 'Invoke-PreCompactHook' {
    BeforeEach {
        $vaultRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $stateFolder = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $captureConfigPath = Join-Path $TestDrive 'capture.json'
        $hookConfigPath = Join-Path $TestDrive 'hook.json'

        New-Item -ItemType Directory -Path (Join-Path $vaultRoot 'pvs') -Force | Out-Null
        'x' | Set-Content (Join-Path $vaultRoot 'pvs' 'pvs-index.md')
        @{ vaults = @($vaultRoot) } | ConvertTo-Json | Set-Content $captureConfigPath
        @{ blockOn = @('auto'); markerTtlMinutes = 30; stateFolder = $stateFolder } | ConvertTo-Json | Set-Content $hookConfigPath

        $env:VAULT_CAPTURE_CONFIG = $captureConfigPath
        $env:VAULT_CAPTURE_PRECOMPACT_CONFIG = $hookConfigPath
    }

    AfterEach {
        Remove-Item Env:\VAULT_CAPTURE_CONFIG, Env:\VAULT_CAPTURE_PRECOMPACT_CONFIG -ErrorAction SilentlyContinue
    }

    It 'blocks the first compaction with the capture instruction' {
        $result = Invoke-Hook -Payload '{"session_id":"s1","trigger":"auto"}'

        $result.ExitCode | Should -Be 2
        $result.Stderr | Should -Match 'Vault rules:'
    }

    It 'allows the second compaction of the same cycle, then blocks the next cycle' {
        $exitCodes = 1..3 | ForEach-Object { (Invoke-Hook -Payload '{"session_id":"s1","trigger":"auto"}').ExitCode }

        $exitCodes | Should -Be @(2, 0, 2)
    }

    It 'allows triggers that are not configured' {
        $result = Invoke-Hook -Payload '{"session_id":"s1","trigger":"manual"}'

        $result.ExitCode | Should -Be 0
    }

    It 'allows compaction when the payload is broken' {
        $result = Invoke-Hook -Payload 'not json'

        $result.ExitCode | Should -Be 0
    }
}
