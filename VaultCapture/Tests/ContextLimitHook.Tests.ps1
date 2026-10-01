BeforeAll {
    $script:HookPath = Join-Path $PSScriptRoot '..' 'Adapters' 'ClaudeCode' 'Invoke-ContextLimitHook.ps1'

    function Invoke-Hook {
        param([hashtable]$Payload)

        $output = $Payload | ConvertTo-Json -Compress | pwsh -NoProfile -File $script:HookPath

        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Decision = if ($output) { ($output -join '') | ConvertFrom-Json } else { $null }
        }
    }

    function New-AssistantLine {
        param(
            [long]$Tokens,
            [string]$Model = 'claude-test',
            [switch]$Sidechain
        )

        $usage = @{ input_tokens = 0; cache_creation_input_tokens = 0; cache_read_input_tokens = $Tokens; output_tokens = 0 }
        $entry = @{ type = 'assistant'; isSidechain = [bool]$Sidechain; message = @{ model = $Model; usage = $usage } }

        return $entry | ConvertTo-Json -Compress -Depth 4
    }

    function Set-Transcript {
        param([string[]]$Lines)

        Set-Content -LiteralPath $script:TranscriptPath -Value $Lines
    }
}

Describe 'Invoke-ContextLimitHook' {
    BeforeEach {
        $vaultRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $stateFolder = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $captureConfigPath = Join-Path $TestDrive 'capture.json'
        $hookConfigPath = Join-Path $TestDrive 'context-limit.json'
        $script:TranscriptPath = Join-Path $TestDrive 'transcript.jsonl'
        $windows = @(@{ model = 'claude-big*'; tokens = 1000 }, @{ model = '*'; tokens = 100 })

        New-Item -ItemType Directory -Path (Join-Path $vaultRoot 'pvs') -Force | Out-Null
        @('---', 'repo: D:/nowhere', '---') | Set-Content (Join-Path $vaultRoot 'pvs' 'pvs-index.md')
        @{ vaults = @($vaultRoot) } | ConvertTo-Json | Set-Content $captureConfigPath
        @{ warnAtPercent = 70; windows = $windows; transcriptTailLines = 50; markerTtlMinutes = 30; stateFolder = $stateFolder } | ConvertTo-Json -Depth 3 | Set-Content $hookConfigPath

        $env:VAULT_CAPTURE_CONFIG = $captureConfigPath
        $env:VAULT_CAPTURE_CONTEXT_LIMIT_CONFIG = $hookConfigPath
        $script:Payload = @{ session_id = 's1'; transcript_path = $script:TranscriptPath; stop_hook_active = $false }
    }

    AfterEach {
        Remove-Item Env:\VAULT_CAPTURE_CONFIG, Env:\VAULT_CAPTURE_CONTEXT_LIMIT_CONFIG -ErrorAction SilentlyContinue
    }

    It 'lets Claude stop below the limit' {
        Set-Transcript -Lines (New-AssistantLine -Tokens 50)

        $result = Invoke-Hook -Payload $script:Payload

        $result.ExitCode | Should -Be 0
        $result.Decision | Should -BeNullOrEmpty
    }

    It 'blocks the stop with the capture instruction at the limit' {
        Set-Transcript -Lines (New-AssistantLine -Tokens 80)

        $result = Invoke-Hook -Payload $script:Payload

        $result.Decision.decision | Should -Be 'block'
        $result.Decision.reason | Should -Match '80% full'
        $result.Decision.reason | Should -Match 'Vault rules:'
        $result.Decision.reason | Should -Match '"source":"session finding: context shrink"'
    }

    It 'warns once per cycle and again after the context dropped below the limit' {
        $blocked = foreach ($tokens in 80, 90, 10, 75) {
            Set-Transcript -Lines (New-AssistantLine -Tokens $tokens)
            [bool](Invoke-Hook -Payload $script:Payload).Decision
        }

        $blocked | Should -Be @($true, $false, $false, $true)
    }

    It 'logs each warning' {
        Set-Transcript -Lines (New-AssistantLine -Tokens 80)

        Invoke-Hook -Payload $script:Payload | Out-Null

        $log = Get-Content -LiteralPath (Join-Path $stateFolder 'warnings.jsonl') | ConvertFrom-Json
        $log.session | Should -Be 's1'
        $log.percent | Should -Be 80
    }

    It 'does not block again while Claude continues because of a Stop hook' {
        Set-Transcript -Lines (New-AssistantLine -Tokens 80)
        $script:Payload.stop_hook_active = $true

        $result = Invoke-Hook -Payload $script:Payload

        $result.Decision | Should -BeNullOrEmpty
    }

    It 'measures the main conversation, not subagent turns' {
        Set-Transcript -Lines @((New-AssistantLine -Tokens 10), (New-AssistantLine -Tokens 95 -Sidechain), 'not json')

        $result = Invoke-Hook -Payload $script:Payload

        $result.Decision | Should -BeNullOrEmpty
    }

    It 'uses the context window of the matching model' {
        Set-Transcript -Lines (New-AssistantLine -Tokens 80 -Model 'claude-big-1')

        $result = Invoke-Hook -Payload $script:Payload

        $result.Decision | Should -BeNullOrEmpty
    }

    It 'lets Claude stop when the payload is broken' {
        $output = 'not json' | pwsh -NoProfile -File $script:HookPath 2> $null

        $LASTEXITCODE | Should -Be 0
        $output | Should -BeNullOrEmpty
    }
}
