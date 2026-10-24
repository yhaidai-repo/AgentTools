BeforeAll {
    $script:ProbePath = Join-Path $PSScriptRoot 'Write-HookPayload.ps1'
    $script:OriginalLog = $env:CODEX_HOOK_PROBE_LOG
}

AfterAll {
    $env:CODEX_HOOK_PROBE_LOG = $script:OriginalLog
}

Describe 'Codex hook payload probe' {
    BeforeEach {
        $env:CODEX_HOOK_PROBE_LOG = Join-Path $TestDrive ([guid]::NewGuid().Guid) 'probe.jsonl'
    }

    It 'appends multiline payloads as individual JSON lines without output' {
        $payload = @"
{
  "session_id": "s1",
  "hook_event_name": "PostToolUse"
}
"@

        $output = $payload | pwsh -NoProfile -NonInteractive -File $script:ProbePath

        $LASTEXITCODE | Should -Be 0
        $output | Should -BeNullOrEmpty

        '{"hook_event_name":"Stop"}' | pwsh -NoProfile -NonInteractive -File $script:ProbePath

        $lines = @(Get-Content -LiteralPath $env:CODEX_HOOK_PROBE_LOG)

        $lines.Count | Should -Be 2
        ($lines[0] | ConvertFrom-Json).session_id | Should -Be 's1'
        ($lines[1] | ConvertFrom-Json).hook_event_name | Should -Be 'Stop'
    }

    It 'preserves UTF-8 paths from hook stdin' {
        $payload = @{ cwd = 'C:/Документи/нотатки'; hook_event_name = 'PostToolUse'; tool_name = 'Bash' } | ConvertTo-Json -Compress

        $payload | pwsh -NoProfile -NonInteractive -File $script:ProbePath

        $written = Get-Content -LiteralPath $env:CODEX_HOOK_PROBE_LOG -Raw | ConvertFrom-Json

        $LASTEXITCODE | Should -Be 0
        $written.cwd | Should -Be 'C:/Документи/нотатки'
    }

    It 'does not interrupt a session when input is malformed' {
        $output = 'not json' | pwsh -NoProfile -NonInteractive -File $script:ProbePath 2>&1

        $LASTEXITCODE | Should -Be 0
        $output | Should -BeNullOrEmpty
        Test-Path -LiteralPath $env:CODEX_HOOK_PROBE_LOG | Should -BeFalse
    }

    It 'does not interrupt a session when the log cannot be created' {
        $blockedPath = Join-Path $TestDrive 'file'

        Set-Content -LiteralPath $blockedPath -Value 'x'
        $env:CODEX_HOOK_PROBE_LOG = Join-Path $blockedPath 'probe.jsonl'

        $output = '{}' | pwsh -NoProfile -NonInteractive -File $script:ProbePath 2>&1

        $LASTEXITCODE | Should -Be 0
        $output | Should -BeNullOrEmpty
    }
}
