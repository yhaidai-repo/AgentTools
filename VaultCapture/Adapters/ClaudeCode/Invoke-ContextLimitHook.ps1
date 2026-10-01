<#
.SYNOPSIS
    Claude Code Stop hook adapter: when the context is nearly full, asks the agent once to save findings to the vault
    while it still has the whole conversation, before compaction summarizes it.
.NOTES
    Blocks the stop with {"decision":"block","reason":...}; Claude Code feeds the reason to Claude, which keeps working.
    One warning per cycle: the marker is cleared once the context drops below the limit again (after compaction).
    Any error lets Claude stop (exit 0, no output): saving is helpful, never a reason to break the session.
#>
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..' '..' 'VaultCapture.psd1')
. (Join-Path $PSScriptRoot 'PreCompactState.ps1')
. (Join-Path $PSScriptRoot 'ContextUsage.ps1')

$script:CaptureSource = 'session finding: context shrink'

function Invoke-ContextLimitHook {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $config = Get-ContextLimitConfig
    $session = [string]$payload.session_id

    # stop_hook_active: Claude is already continuing because of a Stop hook; blocking again could loop.
    if ($payload.stop_hook_active -or -not $session -or -not $payload.transcript_path) {
        return
    }

    $usage = Get-ContextUsage -TranscriptPath $payload.transcript_path -Config $config

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
    Write-BlockDecision -Usage $usage -Cwd $payload.cwd
}

function Write-BlockDecision {
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
    Invoke-ContextLimitHook
}
catch {
    [Console]::Error.WriteLine("vault-capture context-limit hook: $_")
}

exit 0
