$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)


Import-Module (Join-Path $PSScriptRoot '..' '..' 'VaultCapture.psd1')
. (Join-Path $PSScriptRoot 'CodexContextUsage.ps1')

$script:CaptureSource = 'session finding: context shrink'

function Invoke-CodexContextLimitHook {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $config = Get-CodexContextLimitConfig
    $session = [string]$payload.session_id

    if ($payload.stop_hook_active -or -not $session -or -not $payload.transcript_path) {
        return
    }

    $usage = Get-CodexContextUsage -TranscriptPath $payload.transcript_path -Config $config

    if (-not $usage) {
        return
    }

    if ($usage.Percent -lt $config.warnAtPercent) {
        Clear-CaptureRequested -Config $config -Session $session

        return
    }

    if (Test-CaptureRequested -Config $config -Session $session) {
        return
    }

    Set-CaptureRequested -Config $config -Session $session
    Write-ContextLimitLog -Config $config -Session $session -Usage $usage
    Write-CodexBlockDecision -Usage $usage -Cwd $payload.cwd
}

function Write-CodexBlockDecision {
    param(
        [Parameter(Mandatory)][object]$Usage,
        [string]$Cwd
    )

    $reason = "The context is $($Usage.Percent)% full ($($Usage.Tokens) of $($Usage.Window) tokens) and will be compacted soon."
    $instruction = Get-CaptureInstruction -Reason $reason -Cwd $Cwd -Source $script:CaptureSource
    $decision = @{ decision = 'block'; reason = $instruction } | ConvertTo-Json -Compress

    [Console]::Out.Write($decision)
}

try {
    Invoke-CodexContextLimitHook
}
catch {
    [Console]::Error.WriteLine("vault-capture Codex context-limit hook: $_")
}

exit 0
