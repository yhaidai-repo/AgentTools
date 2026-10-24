BeforeAll {
    $script:HookPath = Join-Path $PSScriptRoot '..' 'Adapters' 'Codex' 'Invoke-ContextLimitHook.ps1'

    function Invoke-CodexTestHook {
        param([hashtable]$Payload)

        $output = $Payload | ConvertTo-Json -Compress | pwsh -NoProfile -NonInteractive -File $script:HookPath

        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Decision = if ($output) { ($output -join '') | ConvertFrom-Json } else { $null }
        }
    }

    function Set-CodexTestTranscript {
        param([long]$Tokens, [long]$Window = 100)

        $entry = @{
            type = 'event_msg'
            payload = @{
                type = 'token_count'
                info = @{
                    last_token_usage = @{ total_tokens = $Tokens }
                    model_context_window = $Window
                }
            }
        }

        $entry | ConvertTo-Json -Compress -Depth 6 | Set-Content -LiteralPath $script:TranscriptPath
    }
}

# Synthetic token counts supplement the real desktop Stop payload tested below.
Describe 'Codex context limit Stop hook' {
    BeforeEach {
        $vaultRoot = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $stateFolder = Join-Path $TestDrive ([guid]::NewGuid().Guid)
        $captureConfigPath = Join-Path $TestDrive 'capture.json'
        $hookConfigPath = Join-Path $TestDrive 'codex-context-limit.json'
        $script:TranscriptPath = Join-Path $TestDrive 'codex-transcript.jsonl'

        New-Item -ItemType Directory -Path (Join-Path $vaultRoot 'pvs') -Force | Out-Null
        @('---', 'repo: D:/nowhere', '---') | Set-Content (Join-Path $vaultRoot 'pvs' 'pvs-index.md')
        @{ vaults = @($vaultRoot) } | ConvertTo-Json | Set-Content $captureConfigPath
        @{ warnAtPercent = 70; transcriptTailLines = 50; markerTtlMinutes = 30; stateFolder = $stateFolder } | ConvertTo-Json | Set-Content $hookConfigPath

        $env:VAULT_CAPTURE_CONFIG = $captureConfigPath
        $env:VAULT_CAPTURE_CODEX_CONTEXT_LIMIT_CONFIG = $hookConfigPath
        $script:Payload = @{ session_id = 'codex-s1'; transcript_path = $script:TranscriptPath; stop_hook_active = $false }
    }

    AfterEach {
        Remove-Item Env:\VAULT_CAPTURE_CONFIG, Env:\VAULT_CAPTURE_CODEX_CONTEXT_LIMIT_CONFIG -ErrorAction SilentlyContinue
    }

    It 'accepts a real desktop Stop payload and blocks at the configured threshold' {
        $fixturePath = Join-Path $PSScriptRoot '..' '..' 'VaultUsage' 'Adapters' 'Codex' 'Probe' 'Fixtures' 'stop.json'
        $payload = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json -AsHashtable
        $payload.transcript_path = $script:TranscriptPath
        $payload.session_id = 'captured-stop'

        Set-CodexTestTranscript -Tokens 80

        $result = Invoke-CodexTestHook -Payload $payload

        $result.ExitCode | Should -Be 0
        $result.Decision.decision | Should -Be 'block'
        $result.Decision.reason | Should -Match '80% full'
    }

    It 'allows stopping below the threshold' {
        Set-CodexTestTranscript -Tokens 50

        $result = Invoke-CodexTestHook -Payload $script:Payload

        $result.ExitCode | Should -Be 0
        $result.Decision | Should -BeNullOrEmpty
    }

    It 'blocks once with the capture instruction using the rollout context window' {
        Set-CodexTestTranscript -Tokens 80

        $result = Invoke-CodexTestHook -Payload $script:Payload

        $result.ExitCode | Should -Be 0
        $result.Decision.decision | Should -Be 'block'
        $result.Decision.reason | Should -Match '80% full'
        $result.Decision.reason | Should -Match 'Vault rules:'
        $result.Decision.reason | Should -Match '"source":"session finding: context shrink"'
    }

    It 'warns once per cycle and again after compaction lowers the context' {
        $blocked = foreach ($tokens in 80, 90, 10, 75) {
            Set-CodexTestTranscript -Tokens $tokens
            [bool](Invoke-CodexTestHook -Payload $script:Payload).Decision
        }

        $blocked | Should -Be @($true, $false, $false, $true)
    }

    It 'does not block a continuation triggered by another Stop hook' {
        Set-CodexTestTranscript -Tokens 90
        $script:Payload.stop_hook_active = $true

        (Invoke-CodexTestHook -Payload $script:Payload).Decision | Should -BeNullOrEmpty
    }

    It 'uses the last token count and skips unrelated and malformed lines' {
        Set-CodexTestTranscript -Tokens 90
        Add-Content -LiteralPath $script:TranscriptPath -Value 'not json'
        Add-Content -LiteralPath $script:TranscriptPath -Value '{"type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"total_tokens":10},"model_context_window":100}}}'

        (Invoke-CodexTestHook -Payload $script:Payload).Decision | Should -BeNullOrEmpty
    }

    It 'allows stopping with an invalid context window' {
        Set-CodexTestTranscript -Tokens 80 -Window 0

        (Invoke-CodexTestHook -Payload $script:Payload).Decision | Should -BeNullOrEmpty
    }

    It 'logs the warning once' {
        Set-CodexTestTranscript -Tokens 80
        Invoke-CodexTestHook -Payload $script:Payload | Out-Null

        $log = Get-Content -LiteralPath (Join-Path $stateFolder 'warnings.jsonl') | ConvertFrom-Json

        $log.session | Should -Be 'codex-s1'
        $log.percent | Should -Be 80
    }

    It 'allows stopping when the transcript cannot be parsed' {
        'not json' | Set-Content -LiteralPath $script:TranscriptPath

        (Invoke-CodexTestHook -Payload $script:Payload).Decision | Should -BeNullOrEmpty
    }

    It 'allows stopping when stdin is invalid' {
        $output = 'not json' | pwsh -NoProfile -NonInteractive -File $script:HookPath 2> $null

        $LASTEXITCODE | Should -Be 0
        $output | Should -BeNullOrEmpty
    }
}
