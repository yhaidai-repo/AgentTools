<#
.SYNOPSIS
    Claude Code PreCompact hook adapter: blocks the first compaction of a cycle so the agent can save findings to the vault.
.NOTES
    Exit 2 blocks compaction and sends stderr to Claude. The next attempt in the same cycle is allowed.
    Any error allows compaction (exit 0): saving is helpful, never a reason to break the session.
#>
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..' '..' 'VaultCapture.psd1')
. (Join-Path $PSScriptRoot 'PreCompactState.ps1')

$script:BlockExitCode = 2
$script:AllowExitCode = 0
$script:CaptureSource = 'session finding: context shrink'

function Invoke-PreCompactHook {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $config = Get-PreCompactConfig
    $session = [string]$payload.session_id

    if ($config.blockOn -notcontains $payload.trigger -or -not $session) {
        return $script:AllowExitCode
    }

    if (Test-CaptureRequested -Config $config -Session $session) {
        Clear-CaptureRequested -Config $config -Session $session

        return $script:AllowExitCode
    }

    Set-CaptureRequested -Config $config -Session $session
    $instruction = Get-CaptureInstruction -Reason (Get-BlockReason -Trigger $payload.trigger) -Cwd $payload.cwd -Source $script:CaptureSource

    [Console]::Error.WriteLine($instruction)

    return $script:BlockExitCode
}

function Get-BlockReason {
    param([string]$Trigger)

    $retry = if ($Trigger -eq 'manual') { 'Then the user runs /compact again.' } else { 'Compaction runs on the next attempt.' }

    return "Compaction paused once: the context is about to be compacted. $retry"
}

try {
    $exitCode = Invoke-PreCompactHook
}
catch {
    [Console]::Error.WriteLine("vault-capture pre-compact hook: $_")
    $exitCode = $script:AllowExitCode
}

exit $exitCode
